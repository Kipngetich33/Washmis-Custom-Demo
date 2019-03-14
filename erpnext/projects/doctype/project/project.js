// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt
frappe.ui.form.on("Project", {
	setup: function (frm) {
		frm.set_indicator_formatter('title',
			function (doc) {
				let indicator = 'orange';
				if (doc.status == 'Overdue') {
					indicator = 'red';
				} else if (doc.status == 'Cancelled') {
					indicator = 'dark grey';
				} else if (doc.status == 'Closed') {
					indicator = 'green';
				}
				return indicator;
			}
		);
	},

	onload: function (frm) {
		var so = frappe.meta.get_docfield("Project", "sales_order");
		so.get_route_options_for_new_doc = function (field) {
			if (frm.is_new()) return;
			return {
				"customer": frm.doc.customer,
				"project_name": frm.doc.name
			}
		}

		frm.set_query('customer', 'erpnext.controllers.queries.customer_query');

		frm.set_query("user", "users", function () {
			return {
				query: "erpnext.projects.doctype.project.project.get_users_for_project"
			}
		});

		// sales order
		frm.set_query('sales_order', function () {
			var filters = {
				'project': ["in", frm.doc.__islocal ? [""] : [frm.doc.name, ""]]
			};

			if (frm.doc.customer) {
				filters["customer"] = frm.doc.customer;
			}

			return {
				filters: filters
			}
		});

		if (frappe.model.can_read("Task")) {
			frm.add_custom_button(__("Gantt Chart"), function () {
				frappe.route_options = {
					"project": frm.doc.name
				};
				frappe.set_route("List", "Task", "Gantt");
			});

			frm.add_custom_button(__("Kanban Board"), () => {
				frappe.call('erpnext.projects.doctype.project.project.create_kanban_board_if_not_exists', {
					project: frm.doc.project_name
				}).then(() => {
					frappe.set_route('List', 'Task', 'Kanban', frm.doc.project_name);
				});
			});
		}
	},

	refresh: function (frm) {
		if (frm.doc.__islocal) {
			frm.web_link && frm.web_link.remove();
		} else {
			frm.add_web_link("/projects?project=" + encodeURIComponent(frm.doc.name));

			frm.trigger('show_dashboard');
		}

	},
	tasks_refresh: function (frm) {
		var grid = frm.get_field('tasks').grid;
		grid.wrapper.find('select[data-fieldname="status"]').each(function () {
			if ($(this).val() === 'Open') {
				$(this).addClass('input-indicator-open');
			} else {
				$(this).removeClass('input-indicator-open');
			}
		});
	},
});

frappe.ui.form.on("Project Task", {
	edit_task: function(frm, doctype, name) {
		var doc = frappe.get_doc(doctype, name);
		if(doc.task_id) {
			frappe.set_route("Form", "Task", doc.task_id);
		} else {
			frappe.msgprint(__("Save the document first."));
		}
	},

	edit_timesheet: function(frm, cdt, cdn) {
		var child = locals[cdt][cdn];
		frappe.route_options = {"project": frm.doc.project_name, "task": child.task_id};
		frappe.set_route("List", "Timesheet");
	},

	make_timesheet: function(frm, cdt, cdn) {
		var child = locals[cdt][cdn];
		frappe.model.with_doctype('Timesheet', function() {
			var doc = frappe.model.get_new_doc('Timesheet');
			var row = frappe.model.add_child(doc, 'time_logs');
			row.project = frm.doc.project_name;
			row.task = child.task_id;
			frappe.set_route('Form', doc.doctype, doc.name);
		})
	},

	status: function(frm, doctype, name) {
		frm.trigger('tasks_refresh');
	},
});


// ================================================================================================
/* This section contains code from the general functions section
which are called is the form triggered functions section*/

// function that alerts a message provided to it as parameter
function alert_message(message_to_print){
	msgprint(message_to_print)
}

/* end of the general functions section
// =================================================================================================
/* This section  contains functions that are triggered by the form action refresh or
reload to perform various action*/
// functionality triggered by clicking on the project type


frappe.ui.form.on("Project", "project_type", function (frm) {
	if(frm.doc.project_type == "New Connection Project"){
		
		// get customers for route and billing period
		frappe.call({
			method: "frappe.client.get_list",
			args: 	{
					doctype: "Common Tasks",
					filters: {
						type_of_project:frm.doc.project_type
					},
			fields:["*"]
			},
			callback: function(response) {	
				if(response.message.length == 0){
					alert_message("Please Create Related Tasks Under the Common Tasks doctype")
				}
				else if(response.message.length > 0){
					// ensure that no other task are in the tasks table
					/* ordering of tasks is a useful functionality that should be
					developed especially for tasks that are dependent on others*/
					// ordered_tasks = order_common_tasks(response.message)

					// create tasks on project's child table
					retrive_task_details(frm,response.message)
				}
				else{
					alert_message("Something went wrong while retrieving Reading Sheets")
				}	
			}	
		});
	}
})


// function that users the list of tasks to get details of the tasks
function retrive_task_details(frm,list_of_tasks){
	
	// clear the child table first
	cur_frm.clear_table("tasks"); 
	cur_frm.refresh_fields();

	// get the current document model
	var doc = frappe.model.get_doc('Project',frm.docname);
	doc.department = "Operations - UL"
	
	// initialize largest enddate to 01-01-1970
	var project_end_date = new Date(0);

	for(var i = 0; i< list_of_tasks.length; i++){
		var current_task = list_of_tasks[i]
		
		// create tasks
		var row = frappe.model.add_child(doc, 'tasks');
		row.title = current_task.title_of_task
		row.department = current_task.concerned_department
			
		// get start_date
		var today = new Date();
		var start_date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
		row.start_date = start_date
		
		// get turnaround_days 
		var turnaround_days =  current_task.total_time_to_finish_task
		if((parseFloat(turnaround_days)- parseInt(turnaround_days)) > 0){
			turnaround_days = parseInt(turnaround_days) +1
		}

		// get the end date
		var end_date = get_end_day(today,turnaround_days)
		// get the largest date for all the task
		if(end_date > project_end_date){
			project_end_date = end_date
		}
		
		// add the end date to tasks
		row.end_date = end_date.getFullYear()+'-'+(end_date.getMonth()+1)+'-'+end_date.getDate();

	}

	// set the largest date as the expected end date of the project
	frm.doc.expected_end_date = project_end_date.getFullYear()+'-'+(project_end_date.getMonth()+1)+'-'+project_end_date.getDate();

	// set the project start_date as today
	var date_now = new Date()
	frm.doc.expected_start_date = date_now.getFullYear()+'-'+(date_now.getMonth()+1)+'-'+date_now.getDate();
	cur_frm.refresh()

}

// function that orders the tasks from the first to the last based
// the order the tasks should be done in relation to others
function order_common_tasks(retrieved_tasks){
	console.log("Ordered Common Task")
	var related_tasks = []
	var un_related_tasks = []
	for(var i = 0;i<retrieved_tasks.length;i++){
		var current_task = retrieved_tasks[i]
		if(current_task.does_this_task_require_to_be_handled_after_another_task == "Yes"){
			related_tasks.push(retrieved_tasks[i])
		}
		else{

		}
	}
}


/* function that get the end date of a tasks by adding the turnaround_days
to the start_date*/
function get_end_day(start_date,turnaround_days){

	// define if the current year is leap year
	Date.prototype.addDays = function(days) {
		var date = new Date(this.valueOf());
		date.setDate(date.getDate() + days);
		return date;
	}
	var end_date = start_date.addDays(turnaround_days)

	return end_date
}

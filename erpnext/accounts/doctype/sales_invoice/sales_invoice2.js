// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt

// print heading
cur_frm.pformat.print_heading = 'Invoice';

{% include 'erpnext/selling/sales_common.js' %};


frappe.provide("erpnext.accounts");
erpnext.accounts.SalesInvoiceController = erpnext.selling.SellingController.extend({
	setup: function (doc) {
		this.setup_posting_date_time_check();
		this._super(doc);
	},
	onload: function () {
		var me = this;
		this._super();

		if (!this.frm.doc.__islocal && !this.frm.doc.customer && this.frm.doc.debit_to) {
			// show debit_to in print format
			this.frm.set_df_property("debit_to", "print_hide", 0);
		}

		erpnext.queries.setup_queries(this.frm, "Warehouse", function () {
			return erpnext.queries.warehouse(me.frm.doc);
		});

		if (this.frm.doc.__islocal && this.frm.doc.is_pos) {
			//Load pos profile data on the invoice if the default value of Is POS is 1

			me.frm.script_manager.trigger("is_pos");
			me.frm.refresh_fields();
		}
	},

	refresh: function (doc, dt, dn) {
		const me = this;
		this._super();
		if (cur_frm.msgbox && cur_frm.msgbox.$wrapper.is(":visible")) {
			// hide new msgbox
			cur_frm.msgbox.hide();
		}

		this.frm.toggle_reqd("due_date", !this.frm.doc.is_return);

		this.show_general_ledger();

		if (doc.update_stock) this.show_stock_ledger();

		if (doc.docstatus == 1 && doc.outstanding_amount != 0
			&& !(cint(doc.is_return) && doc.return_against)) {
			cur_frm.add_custom_button(__('Payment'),
				this.make_payment_entry, __("Make"));
			cur_frm.page.set_inner_btn_group_as_primary(__("Make"));
		}

		if (doc.docstatus == 1 && !doc.is_return) {

			var is_delivered_by_supplier = false;

			is_delivered_by_supplier = cur_frm.doc.items.some(function (item) {
				return item.is_delivered_by_supplier ? true : false;
			})

			if (doc.outstanding_amount >= 0 || Math.abs(flt(doc.outstanding_amount)) < flt(doc.grand_total)) {
				cur_frm.add_custom_button(__('Return / Credit Note'),
					this.make_sales_return, __("Make"));
				cur_frm.page.set_inner_btn_group_as_primary(__("Make"));
			}

			if (cint(doc.update_stock) != 1) {
				// show Make Delivery Note button only if Sales Invoice is not created from Delivery Note
				var from_delivery_note = false;
				from_delivery_note = cur_frm.doc.items
					.some(function (item) {
						return item.delivery_note ? true : false;
					});

				if (!from_delivery_note && !is_delivered_by_supplier) {
					cur_frm.add_custom_button(__('Delivery'),
						cur_frm.cscript['Make Delivery Note'], __("Make"));
				}
			}

			if (doc.outstanding_amount > 0 && !cint(doc.is_return)) {
				cur_frm.add_custom_button(__('Payment Request'), function () {
					me.make_payment_request();
				}, __("Make"));
			}

			if (!doc.auto_repeat) {
				cur_frm.add_custom_button(__('Subscription'), function () {
					erpnext.utils.make_subscription(doc.doctype, doc.name)
				}, __("Make"))
			}
		}

		// Show buttons only when pos view is active
		if (cint(doc.docstatus == 0) && cur_frm.page.current_view_name !== "pos" && !doc.is_return) {
			this.frm.cscript.sales_order_btn();
			this.frm.cscript.delivery_note_btn();
			this.frm.cscript.quotation_btn();
		}

		this.set_default_print_format();
		if (doc.docstatus == 1 && !doc.inter_company_invoice_reference) {
			frappe.model.with_doc("Customer", me.frm.doc.customer, function () {
				var customer = frappe.model.get_doc("Customer", me.frm.doc.customer);
				var internal = customer.is_internal_customer;
				var disabled = customer.disabled;
				if (internal == 1 && disabled == 0) {
					me.frm.add_custom_button("Inter Company Invoice", function () {
						me.make_inter_company_invoice();
					}, __("Make"));
				}
			});
		}
	},

	on_submit: function (doc, dt, dn) {
		var me = this;

		if (frappe.get_route()[0] != 'Form') {
			return
		}

		$.each(doc["items"], function (i, row) {
			if (row.delivery_note) frappe.model.clear_doc("Delivery Note", row.delivery_note)
		})
	},

	set_default_print_format: function () {
		// set default print format to POS type
		if (cur_frm.doc.is_pos) {
			if (cur_frm.pos_print_format) {
				cur_frm.meta._default_print_format = cur_frm.meta.default_print_format;
				cur_frm.meta.default_print_format = cur_frm.pos_print_format;
			}
		} else {
			if (cur_frm.meta._default_print_format) {
				cur_frm.meta.default_print_format = cur_frm.meta._default_print_format;
				cur_frm.meta._default_print_format = null;
			}
		}
	},

	sales_order_btn: function () {
		var me = this;
		this.$sales_order_btn = this.frm.add_custom_button(__('Sales Order'),
			function () {
				erpnext.utils.map_current_doc({
					method: "erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice",
					source_doctype: "Sales Order",
					target: me.frm,
					setters: {
						customer: me.frm.doc.customer || undefined,
					},
					get_query_filters: {
						docstatus: 1,
						status: ["!=", "Closed"],
						per_billed: ["<", 99.99],
						company: me.frm.doc.company
					}
				})
			}, __("Get items from"));
	},

	quotation_btn: function () {
		var me = this;
		this.$quotation_btn = this.frm.add_custom_button(__('Quotation'),
			function () {
				erpnext.utils.map_current_doc({
					method: "erpnext.selling.doctype.quotation.quotation.make_sales_invoice",
					source_doctype: "Quotation",
					target: me.frm,
					setters: {
						customer: me.frm.doc.customer || undefined,
					},
					get_query_filters: {
						docstatus: 1,
						status: ["!=", "Lost"],
						company: me.frm.doc.company
					}
				})
			}, __("Get items from"));
	},

	delivery_note_btn: function () {
		var me = this;
		this.$delivery_note_btn = this.frm.add_custom_button(__('Delivery Note'),
			function () {
				erpnext.utils.map_current_doc({
					method: "erpnext.stock.doctype.delivery_note.delivery_note.make_sales_invoice",
					source_doctype: "Delivery Note",
					target: me.frm,
					date_field: "posting_date",
					setters: {
						customer: me.frm.doc.customer || undefined
					},
					get_query: function () {
						var filters = {
							docstatus: 1,
							company: me.frm.doc.company
						};
						if (me.frm.doc.customer) filters["customer"] = me.frm.doc.customer;
						return {
							query: "erpnext.controllers.queries.get_delivery_notes_to_be_billed",
							filters: filters
						};
					}
				});
			}, __("Get items from"));
	},

	tc_name: function () {
		this.get_terms();
	},
	customer: function () {
		var me = this;
		if (this.frm.updating_party_details) return;
		erpnext.utils.get_party_details(this.frm,
			"erpnext.accounts.party.get_party_details", {
				posting_date: this.frm.doc.posting_date,
				party: this.frm.doc.customer,
				party_type: "Customer",
				account: this.frm.doc.debit_to,
				price_list: this.frm.doc.selling_price_list,
			}, function () {
				me.apply_pricing_rule();
			});

		if (this.frm.doc.customer) {
			frappe.call({
				"method": "erpnext.accounts.doctype.sales_invoice.sales_invoice.get_loyalty_programs",
				"args": {
					"customer": this.frm.doc.customer
				},
				callback: function (r) {
					if (r.message && r.message.length) {
						select_loyalty_program(me.frm, r.message);
					}
				}
			});
		}
	},

	make_inter_company_invoice: function () {
		frappe.model.open_mapped_doc({
			method: "erpnext.accounts.doctype.sales_invoice.sales_invoice.make_inter_company_purchase_invoice",
			frm: me.frm
		});
	},

	debit_to: function () {
		var me = this;
		if (this.frm.doc.debit_to) {
			me.frm.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Account",
					fieldname: "account_currency",
					filters: { name: me.frm.doc.debit_to },
				},
				callback: function (r, rt) {
					if (r.message) {
						me.frm.set_value("party_account_currency", r.message.account_currency);
						me.set_dynamic_labels();
					}
				}
			});
		}
	},

	allocated_amount: function () {
		this.calculate_total_advance();
		this.frm.refresh_fields();
	},

	write_off_outstanding_amount_automatically: function () {
		if (cint(this.frm.doc.write_off_outstanding_amount_automatically)) {
			frappe.model.round_floats_in(this.frm.doc, ["grand_total", "paid_amount"]);
			// this will make outstanding amount 0
			this.frm.set_value("write_off_amount",
				flt(this.frm.doc.grand_total - this.frm.doc.paid_amount - this.frm.doc.total_advance, precision("write_off_amount"))
			);
			this.frm.toggle_enable("write_off_amount", false);

		} else {
			this.frm.toggle_enable("write_off_amount", true);
		}

		this.calculate_outstanding_amount(false);
		this.frm.refresh_fields();
	},

	write_off_amount: function () {
		this.set_in_company_currency(this.frm.doc, ["write_off_amount"]);
		this.write_off_outstanding_amount_automatically();
	},

	items_add: function (doc, cdt, cdn) {
		var row = frappe.get_doc(cdt, cdn);
		this.frm.script_manager.copy_from_first_row("items", row, ["income_account", "cost_center"]);
	},

	set_dynamic_labels: function () {
		this._super();
		this.hide_fields(this.frm.doc);
	},

	items_on_form_rendered: function () {
		erpnext.setup_serial_no();
	},

	make_sales_return: function () {
		frappe.model.open_mapped_doc({
			method: "erpnext.accounts.doctype.sales_invoice.sales_invoice.make_sales_return",
			frm: cur_frm
		})
	},

	asset: function (frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (row.asset) {
			frappe.call({
				method: erpnext.assets.doctype.asset.depreciation.get_disposal_account_and_cost_center,
				args: {
					"company": frm.doc.company
				},
				callback: function (r, rt) {
					frappe.model.set_value(cdt, cdn, "income_account", r.message[0]);
					frappe.model.set_value(cdt, cdn, "cost_center", r.message[1]);
				}
			})
		}
	},

	is_pos: function (frm) {
		this.set_pos_data();
	},

	pos_profile: function () {
		this.frm.doc.taxes = []
		this.set_pos_data();
	},

	set_pos_data: function () {
		if (this.frm.doc.is_pos) {
			if (!this.frm.doc.company) {
				this.frm.set_value("is_pos", 0);
				frappe.msgprint(__("Please specify Company to proceed"));
			} else {
				var me = this;
				return this.frm.call({
					doc: me.frm.doc,
					method: "set_missing_values",
					callback: function (r) {
						if (!r.exc) {
							if (r.message && r.message.print_format) {
								me.frm.pos_print_format = r.message.print_format;
							}
							me.frm.script_manager.trigger("update_stock");
							frappe.model.set_default_values(me.frm.doc);
							me.set_dynamic_labels();
							me.calculate_taxes_and_totals();
						}
					}
				});
			}
		}
		else this.frm.trigger("refresh");
	},

	amount: function () {
		this.write_off_outstanding_amount_automatically()
	},

	change_amount: function () {
		if (this.frm.doc.paid_amount > this.frm.doc.grand_total) {
			this.calculate_write_off_amount();
		} else {
			this.frm.set_value("change_amount", 0.0);
			this.frm.set_value("base_change_amount", 0.0);
		}

		this.frm.refresh_fields();
	},

	loyalty_amount: function () {
		this.calculate_outstanding_amount();
		this.frm.refresh_field("outstanding_amount");
		this.frm.refresh_field("paid_amount");
		this.frm.refresh_field("base_paid_amount");
	}
});

// for backward compatibility: combine new and previous states
$.extend(cur_frm.cscript, new erpnext.accounts.SalesInvoiceController({ frm: cur_frm }));

// Hide Fields
// ------------
cur_frm.cscript.hide_fields = function (doc) {
	var parent_fields = ['project', 'due_date', 'is_opening', 'source', 'total_advance', 'get_advances',
		'advances', 'from_date', 'to_date'];

	if (cint(doc.is_pos) == 1) {
		hide_field(parent_fields);
	} else {
		for (var i in parent_fields) {
			var docfield = frappe.meta.docfield_map[doc.doctype][parent_fields[i]];
			if (!docfield.hidden) unhide_field(parent_fields[i]);
		}
	}

	// India related fields
	if (frappe.boot.sysdefaults.country == 'India') unhide_field(['c_form_applicable', 'c_form_no']);
	else hide_field(['c_form_applicable', 'c_form_no']);

	this.frm.toggle_enable("write_off_amount", !!!cint(doc.write_off_outstanding_amount_automatically));

	cur_frm.refresh_fields();
}

cur_frm.cscript.update_stock = function (doc, dt, dn) {
	cur_frm.cscript.hide_fields(doc, dt, dn);
	this.frm.fields_dict.items.grid.toggle_reqd("item_code", doc.update_stock ? true : false)
}

cur_frm.cscript['Make Delivery Note'] = function () {
	frappe.model.open_mapped_doc({
		method: "erpnext.accounts.doctype.sales_invoice.sales_invoice.make_delivery_note",
		frm: cur_frm
	})
}

cur_frm.fields_dict.cash_bank_account.get_query = function (doc) {
	return {
		filters: [
			["Account", "account_type", "in", ["Cash", "Bank"]],
			["Account", "root_type", "=", "Asset"],
			["Account", "is_group", "=", 0],
			["Account", "company", "=", doc.company]
		]
	}
}

cur_frm.fields_dict.write_off_account.get_query = function (doc) {
	return {
		filters: {
			'report_type': 'Profit and Loss',
			'is_group': 0,
			'company': doc.company
		}
	}
}

// Write off cost center
//-----------------------
cur_frm.fields_dict.write_off_cost_center.get_query = function (doc) {
	return {
		filters: {
			'is_group': 0,
			'company': doc.company
		}
	}
}

// project name
//--------------------------
cur_frm.fields_dict['project'].get_query = function (doc, cdt, cdn) {
	return {
		query: "erpnext.controllers.queries.get_project_name",
		filters: { 'customer': doc.customer }
	}
}

// Income Account in Details Table
// --------------------------------
cur_frm.set_query("income_account", "items", function (doc) {
	return {
		query: "erpnext.controllers.queries.get_income_account",
		filters: { 'company': doc.company }
	}
});


// Cost Center in Details Table
// -----------------------------
cur_frm.fields_dict["items"].grid.get_field("cost_center").get_query = function (doc) {
	return {
		filters: {
			'company': doc.company,
			"is_group": 0
		}
	}
}

cur_frm.cscript.income_account = function (doc, cdt, cdn) {
	erpnext.utils.copy_value_in_all_rows(doc, cdt, cdn, "items", "income_account");
}

cur_frm.cscript.expense_account = function (doc, cdt, cdn) {
	erpnext.utils.copy_value_in_all_rows(doc, cdt, cdn, "items", "expense_account");
}

cur_frm.cscript.cost_center = function (doc, cdt, cdn) {
	erpnext.utils.copy_value_in_all_rows(doc, cdt, cdn, "items", "cost_center");
}

cur_frm.set_query("debit_to", function (doc) {
	// filter on Account
	if (doc.customer) {
		return {
			filters: {
				'account_type': 'Receivable',
				'is_group': 0,
				'company': doc.company
			}
		}
	} else {
		return {
			filters: {
				'report_type': 'Balance Sheet',
				'is_group': 0,
				'company': doc.company
			}
		}
	}
});

cur_frm.set_query("asset", "items", function (doc, cdt, cdn) {
	var d = locals[cdt][cdn];
	return {
		filters: [
			["Asset", "item_code", "=", d.item_code],
			["Asset", "docstatus", "=", 1],
			["Asset", "status", "in", ["Submitted", "Partially Depreciated", "Fully Depreciated"]],
			["Asset", "company", "=", doc.company]
		]
	}
});

frappe.ui.form.on('Sales Invoice', {
	setup: function (frm) {
		frm.add_fetch('customer', 'tax_id', 'tax_id');
		frm.add_fetch('payment_term', 'invoice_portion', 'invoice_portion');
		frm.add_fetch('payment_term', 'description', 'description');

		frm.custom_make_buttons = {
			'Delivery Note': 'Delivery',
			'Sales Invoice': 'Sales Return',
			'Payment Request': 'Payment Request',
			'Payment Entry': 'Payment'
		},
			frm.fields_dict["timesheets"].grid.get_field("time_sheet").get_query = function (doc, cdt, cdn) {
				return {
					query: "erpnext.projects.doctype.timesheet.timesheet.get_timesheet",
					filters: { 'project': doc.project }
				}
			}

		// expense account
		frm.fields_dict['items'].grid.get_field('expense_account').get_query = function (doc) {
			if (erpnext.is_perpetual_inventory_enabled(doc.company)) {
				return {
					filters: {
						'report_type': 'Profit and Loss',
						'company': doc.company,
						"is_group": 0
					}
				}
			}
		}

		frm.fields_dict['items'].grid.get_field('deferred_revenue_account').get_query = function (doc) {
			return {
				filters: {
					'root_type': 'Liability',
					'company': doc.company,
					"is_group": 0
				}
			}
		}

		frm.set_query('company_address', function (doc) {
			if (!doc.company) {
				frappe.throw(_('Please set Company'));
			}

			return {
				query: 'frappe.contacts.doctype.address.address.address_query',
				filters: {
					link_doctype: 'Company',
					link_name: doc.company
				}
			};
		});

		frm.set_query('pos_profile', function (doc) {
			if (!doc.company) {
				frappe.throw(_('Please set Company'));
			}

			return {
				query: 'erpnext.accounts.doctype.pos_profile.pos_profile.pos_profile_query',
				filters: {
					company: doc.company
				}
			};
		});

		// set get_query for loyalty redemption account
		frm.fields_dict["loyalty_redemption_account"].get_query = function () {
			return {
				filters: {
					"company": frm.doc.company
				}
			}
		};

		// set get_query for loyalty redemption cost center
		frm.fields_dict["loyalty_redemption_cost_center"].get_query = function () {
			return {
				filters: {
					"company": frm.doc.company
				}
			}
		};
	},
	// When multiple companies are set up. in case company name is changed set default company address
	company: function (frm) {
		if (frm.doc.company) {
			frappe.call({
				method: "frappe.contacts.doctype.address.address.get_default_address",
				args: { doctype: 'Company', name: frm.doc.company },
				callback: function (r) {
					if (r.message) {
						frm.set_value("company_address", r.message)
					}
					else {
						frm.set_value("company_address", "")
					}
				}
			})
		}
	},

	project: function (frm) {
		frm.call({
			method: "add_timesheet_data",
			doc: frm.doc,
			callback: function (r, rt) {
				refresh_field(['timesheets'])
			}
		})
	},

	onload: function (frm) {
		frm.redemption_conversion_factor = null;
	},

	redeem_loyalty_points: function (frm) {
		frm.events.get_loyalty_details(frm);
	},

	loyalty_points: function (frm) {
		if (frm.redemption_conversion_factor) {
			frm.events.set_loyalty_points(frm);
		} else {
			frappe.call({
				method: "erpnext.accounts.doctype.loyalty_program.loyalty_program.get_redeemption_factor",
				args: {
					"loyalty_program": frm.doc.loyalty_program
				},
				callback: function (r) {
					if (r) {
						frm.redemption_conversion_factor = r.message;
						frm.events.set_loyalty_points(frm);
					}
				}
			});
		}
	},

	get_loyalty_details: function (frm) {
		if (frm.doc.customer && frm.doc.redeem_loyalty_points) {
			frappe.call({
				method: "erpnext.accounts.doctype.loyalty_program.loyalty_program.get_loyalty_program_details",
				args: {
					"customer": frm.doc.customer,
					"loyalty_program": frm.doc.loyalty_program,
					"expiry_date": frm.doc.posting_date,
					"company": frm.doc.company
				},
				callback: function (r) {
					if (r) {
						frm.set_value("loyalty_redemption_account", r.message.expense_account);
						frm.set_value("loyalty_redemption_cost_center", r.message.cost_center);
						frm.redemption_conversion_factor = r.message.conversion_factor;
					}
				}
			});
		}
	},

	set_loyalty_points: function (frm) {
		if (frm.redemption_conversion_factor) {
			let loyalty_amount = flt(frm.redemption_conversion_factor * flt(frm.doc.loyalty_points), precision("loyalty_amount"));
			var remaining_amount = flt(frm.doc.grand_total) - flt(frm.doc.total_advance) - flt(frm.doc.write_off_amount);
			if (frm.doc.grand_total && (remaining_amount < loyalty_amount)) {
				let redeemable_points = parseInt(remaining_amount / frm.redemption_conversion_factor);
				frappe.throw(__("You can only redeem max {0} points in this order.", [redeemable_points]));
			}
			frm.set_value("loyalty_amount", loyalty_amount);
		}
	},

	// Healthcare
	patient: function (frm) {
		if (frappe.boot.active_domains.includes("Healthcare")) {
			if (frm.doc.patient) {
				frappe.call({
					method: "frappe.client.get_value",
					args: {
						doctype: "Patient",
						filters: { "name": frm.doc.patient },
						fieldname: "customer"
					},
					callback: function (patient_customer) {
						if (patient_customer) {
							frm.set_value("customer", patient_customer.message.customer);
							frm.refresh_fields();
						}
					}
				});
			}
			else {
				frm.set_value("customer", '');
			}
		}
	},
	refresh: function (frm) {
		if (frappe.boot.active_domains.includes("Healthcare")) {
			frm.set_df_property("patient", "hidden", 0);
			frm.set_df_property("patient_name", "hidden", 0);
			frm.set_df_property("ref_practitioner", "hidden", 0);
			if (cint(frm.doc.docstatus == 0) && cur_frm.page.current_view_name !== "pos" && !frm.doc.is_return) {
				frm.add_custom_button(__('Healthcare Services'), function () {
					get_healthcare_services_to_invoice(frm);
				}, "Get items from");
				frm.add_custom_button(__('Prescriptions'), function () {
					get_drugs_to_invoice(frm);
				}, "Get items from");
			}
		}
		else {
			frm.set_df_property("patient", "hidden", 1);
			frm.set_df_property("patient_name", "hidden", 1);
			frm.set_df_property("ref_practitioner", "hidden", 1);
		}
	}
})

frappe.ui.form.on('Sales Invoice Timesheet', {
	time_sheet: function (frm, cdt, cdn) {
		var d = locals[cdt][cdn];
		if (d.time_sheet) {
			frappe.call({
				method: "erpnext.projects.doctype.timesheet.timesheet.get_timesheet_data",
				args: {
					'name': d.time_sheet,
					'project': frm.doc.project || null
				},
				callback: function (r, rt) {
					if (r.message) {
						data = r.message;
						frappe.model.set_value(cdt, cdn, "billing_hours", data.billing_hours);
						frappe.model.set_value(cdt, cdn, "billing_amount", data.billing_amount);
						frappe.model.set_value(cdt, cdn, "timesheet_detail", data.timesheet_detail);
						calculate_total_billing_amount(frm)
					}
				}
			})
		}
	}
})

var calculate_total_billing_amount = function (frm) {
	var doc = frm.doc;

	doc.total_billing_amount = 0.0
	if (doc.timesheets) {
		$.each(doc.timesheets, function (index, data) {
			doc.total_billing_amount += data.billing_amount
		})
	}

	refresh_field('total_billing_amount')
}

var select_loyalty_program = function (frm, loyalty_programs) {
	var dialog = new frappe.ui.Dialog({
		title: __("Select Loyalty Program"),
		fields: [
			{
				"label": __("Loyalty Program"),
				"fieldname": "loyalty_program",
				"fieldtype": "Select",
				"options": loyalty_programs,
				"default": loyalty_programs[0]
			}
		]
	});

	dialog.set_primary_action(__("Set"), function () {
		dialog.hide();
		return frappe.call({
			method: "frappe.client.set_value",
			args: {
				doctype: "Customer",
				name: frm.doc.customer,
				fieldname: "loyalty_program",
				value: dialog.get_value("loyalty_program"),
			},
			callback: function (r) { }
		});
	});

	dialog.show();
}

// Healthcare
var get_healthcare_services_to_invoice = function (frm) {
	var me = this;
	let selected_patient = '';
	var dialog = new frappe.ui.Dialog({
		title: __("Get Items from Healthcare Services"),
		fields: [
			{
				fieldtype: 'Link',
				options: 'Patient',
				label: 'Patient',
				fieldname: "patient",
				reqd: true
			},
			{ fieldtype: 'Section Break' },
			{ fieldtype: 'HTML', fieldname: 'results_area' }
		]
	});
	var $wrapper;
	var $results;
	var $placeholder;
	dialog.set_values({
		'patient': frm.doc.patient
	});
	dialog.fields_dict["patient"].df.onchange = () => {
		var patient = dialog.fields_dict.patient.input.value;
		if (patient && patient != selected_patient) {
			selected_patient = patient;
			var method = "erpnext.healthcare.utils.get_healthcare_services_to_invoice";
			var args = { patient: patient };
			var columns = (["service", "reference_name", "reference_type"]);
			get_healthcare_items(frm, true, $results, $placeholder, method, args, columns);
		}
		else if (!patient) {
			selected_patient = '';
			$results.empty();
			$results.append($placeholder);
		}
	}
	$wrapper = dialog.fields_dict.results_area.$wrapper.append(`<div class="results"
		style="border: 1px solid #d1d8dd; border-radius: 3px; height: 300px; overflow: auto;"></div>`);
	$results = $wrapper.find('.results');
	$placeholder = $(`<div class="multiselect-empty-state">
				<span class="text-center" style="margin-top: -40px;">
					<i class="fa fa-2x fa-heartbeat text-extra-muted"></i>
					<p class="text-extra-muted">No billable Healthcare Services found</p>
				</span>
			</div>`);
	$results.on('click', '.list-item--head :checkbox', (e) => {
		$results.find('.list-item-container .list-row-check')
			.prop("checked", ($(e.target).is(':checked')));
	});
	set_primary_action(frm, dialog, $results, true);
	dialog.show();
};

var get_healthcare_items = function (frm, invoice_healthcare_services, $results, $placeholder, method, args, columns) {
	var me = this;
	$results.empty();
	frappe.call({
		method: method,
		args: args,
		callback: function (data) {
			if (data.message) {
				$results.append(make_list_row(columns, invoice_healthcare_services));
				for (let i = 0; i < data.message.length; i++) {
					$results.append(make_list_row(columns, invoice_healthcare_services, data.message[i]));
				}
			} else {
				$results.append($placeholder);
			}
		}
	});
}

var make_list_row = function (columns, invoice_healthcare_services, result = {}) {
	var me = this;
	// Make a head row by default (if result not passed)
	let head = Object.keys(result).length === 0;
	let contents = ``;
	columns.forEach(function (column) {
		contents += `<div class="list-item__content ellipsis">
			${
			head ? `<span class="ellipsis">${__(frappe.model.unscrub(column))}</span>`

				: (column !== "name" ? `<span class="ellipsis">${__(result[column])}</span>`
					: `<a class="list-id ellipsis">
						${__(result[column])}</a>`)
			}
		</div>`;
	})

	let $row = $(`<div class="list-item">
		<div class="list-item__content" style="flex: 0 0 10px;">
			<input type="checkbox" class="list-row-check" ${result.checked ? 'checked' : ''}>
		</div>
		${contents}
	</div>`);

	$row = list_row_data_items(head, $row, result, invoice_healthcare_services);
	return $row;
};

var set_primary_action = function (frm, dialog, $results, invoice_healthcare_services) {
	var me = this;
	dialog.set_primary_action(__('Add'), function () {
		let checked_values = get_checked_values($results);
		if (checked_values.length > 0) {
			frm.set_value("patient", dialog.fields_dict.patient.input.value);
			frm.set_value("items", []);
			add_to_item_line(frm, checked_values, invoice_healthcare_services);
			dialog.hide();
		}
		else {
			if (invoice_healthcare_services) {
				frappe.msgprint(__("Please select Healthcare Service"));
			}
			else {
				frappe.msgprint(__("Please select Drug"));
			}
		}
	});
};

var get_checked_values = function ($results) {
	return $results.find('.list-item-container').map(function () {
		let checked_values = {};
		if ($(this).find('.list-row-check:checkbox:checked').length > 0) {
			checked_values['dn'] = $(this).attr('data-dn');
			checked_values['dt'] = $(this).attr('data-dt');
			checked_values['item'] = $(this).attr('data-item');
			if ($(this).attr('data-rate') != 'undefined') {
				checked_values['rate'] = $(this).attr('data-rate');
			}
			else {
				checked_values['rate'] = false;
			}
			if ($(this).attr('data-income-account') != 'undefined') {
				checked_values['income_account'] = $(this).attr('data-income-account');
			}
			else {
				checked_values['income_account'] = false;
			}
			if ($(this).attr('data-qty') != 'undefined') {
				checked_values['qty'] = $(this).attr('data-qty');
			}
			else {
				checked_values['qty'] = false;
			}
			if ($(this).attr('data-description') != 'undefined') {
				checked_values['description'] = $(this).attr('data-description');
			}
			else {
				checked_values['description'] = false;
			}
			return checked_values;
		}
	}).get();
};

var get_drugs_to_invoice = function (frm) {
	var me = this;
	let selected_encounter = '';
	var dialog = new frappe.ui.Dialog({
		title: __("Get Items from Prescriptions"),
		fields: [
			{ fieldtype: 'Link', options: 'Patient', label: 'Patient', fieldname: "patient", reqd: true },
			{
				fieldtype: 'Link', options: 'Patient Encounter', label: 'Patient Encounter', fieldname: "encounter", reqd: true,
				description: 'Quantity will be calculated only for items which has "Nos" as UoM. You may change as required for each invoice item.',
				get_query: function (doc) {
					return {
						filters: { patient: dialog.get_value("patient"), docstatus: 1 }
					};
				}
			},
			{ fieldtype: 'Section Break' },
			{ fieldtype: 'HTML', fieldname: 'results_area' }
		]
	});
	var $wrapper;
	var $results;
	var $placeholder;
	dialog.set_values({
		'patient': frm.doc.patient,
		'encounter': ""
	});
	dialog.fields_dict["encounter"].df.onchange = () => {
		var encounter = dialog.fields_dict.encounter.input.value;
		if (encounter && encounter != selected_encounter) {
			selected_encounter = encounter;
			var method = "erpnext.healthcare.utils.get_drugs_to_invoice";
			var args = { encounter: encounter };
			var columns = (["drug_code", "quantity", "description"]);
			get_healthcare_items(frm, false, $results, $placeholder, method, args, columns);
		}
		else if (!encounter) {
			selected_encounter = '';
			$results.empty();
			$results.append($placeholder);
		}
	}
	$wrapper = dialog.fields_dict.results_area.$wrapper.append(`<div class="results"
		style="border: 1px solid #d1d8dd; border-radius: 3px; height: 300px; overflow: auto;"></div>`);
	$results = $wrapper.find('.results');
	$placeholder = $(`<div class="multiselect-empty-state">
				<span class="text-center" style="margin-top: -40px;">
					<i class="fa fa-2x fa-heartbeat text-extra-muted"></i>
					<p class="text-extra-muted">No Drug Prescription found</p>
				</span>
			</div>`);
	$results.on('click', '.list-item--head :checkbox', (e) => {
		$results.find('.list-item-container .list-row-check')
			.prop("checked", ($(e.target).is(':checked')));
	});
	set_primary_action(frm, dialog, $results, false);
	dialog.show();
};

var list_row_data_items = function (head, $row, result, invoice_healthcare_services) {
	if (invoice_healthcare_services) {
		head ? $row.addClass('list-item--head')
			: $row = $(`<div class="list-item-container"
				data-dn= "${result.reference_name}" data-dt= "${result.reference_type}" data-item= "${result.service}"
				data-rate = ${result.rate}
				data-income-account = "${result.income_account}"
				data-qty = ${result.qty}
				data-description = "${result.description}">
				</div>`).append($row);
	}
	else {
		head ? $row.addClass('list-item--head')
			: $row = $(`<div class="list-item-container"
				data-item= "${result.drug_code}"
				data-qty = ${result.quantity}
				data-description = "${result.description}">
				</div>`).append($row);
	}
	return $row
};

var add_to_item_line = function (frm, checked_values, invoice_healthcare_services) {
	if (invoice_healthcare_services) {
		frappe.call({
			doc: frm.doc,
			method: "set_healthcare_services",
			args: {
				checked_values: checked_values
			},
			callback: function () {
				frm.trigger("validate");
				frm.refresh_fields();
			}
		});
	}
	else {
		for (let i = 0; i < checked_values.length; i++) {
			var si_item = frappe.model.add_child(frm.doc, 'Sales Invoice Item', 'items');
			frappe.model.set_value(si_item.doctype, si_item.name, 'item_code', checked_values[i]['item']);
			frappe.model.set_value(si_item.doctype, si_item.name, 'qty', 1);
			if (checked_values[i]['qty'] > 1) {
				frappe.model.set_value(si_item.doctype, si_item.name, 'qty', parseFloat(checked_values[i]['qty']));
			}
		}
		frm.refresh_fields();
	}
};


// The section below contains custom scripts for the sales invoice
// ================================================================================================
/* This section contains code from the general functions section
which are called is the form triggered functions section*/

// global variables
var rowcount = 0;
var currentrow = 0;
var customer_meter_no
var disconnection_profiles
var defined_flat_rate = "0-6"
var defined_grace_period = 14
var required_fields_for_each_invoice = {
	bill: ["customer", "billing_period", "route", "area", "zone",
		"previous_reading", "current_reading", "consumption",
		"type_of_bill", "disconnection_profile", "type_of_customer",
		"type_of_invoice"
	],
	new_connection_fee: ["customer", "route", "area", "zone", 
					"project","type_of_customer","type_of_invoice"
				],
	// deposit: ["customer", "route", "area", "zone", "project"],
	deposit: ["customer","type_of_customer","type_of_invoice"],
	penalty: ["customer", "type_of_customer","type_of_invoice","route", "area", "zone"],
	other: ["customer","type_of_customer","type_of_invoice"]
}

var field_to_hide_unhide = {
	bill: ["billing_period", "route", "area", "zone",
		"previous_reading", "current_reading", "consumption",
		"disconnection_profile", "type_of_bill", "collect_items"
	],
	new_connection_fee: ["route", "area", "zone", "project",
		"collect_items"],
	deposit: ["route", "area", "zone", "project", "collect_items"],
	penalty: ["route", "area", "zone", "collect_items"],
	other: [],
	all: ["billing_period", "route", "area", "zone",
		"previous_reading", "current_reading", "consumption",
		"disconnection_profile", "project", "type_of_bill",
		"collect_items"
	],
}

// 
// function that adds rows to items child table
function add_rows_and_values(frm,i, current_item_name) {
	cur_frm.clear_table("items");
	cur_frm.refresh_field("items");
	// frm.grids[0].grid.add_new_row(null, null, false);
	// frm.refresh_field("items");
	// var new_row = frm.add_child("items");
	// frm.refresh_field("items");
	// frm.doc.items[i].item = current_item_name
}

// function that alerts a message provided to it as parameter
function alert_message(message_to_print) {
	msgprint(message_to_print)
}


// function that converts a string date to a date object
function parse_date(current_date) {
	var split_date = current_date.split("-")
	var current_month = parseInt(split_date[1]) - 1
	var date_object = new Date(split_date[0], current_month, split_date[2])
	return date_object
}

// function that sets the disconnection date
function set_disconnection_date() {
	// check if date is already set 
	var days_difference_in_secs = parse_date(cur_frm.doc.due_date) - parse_date(cur_frm.doc.posting_date)
	var days_difference = days_difference_in_secs / 86400000

	if (days_difference < defined_grace_period && cur_frm.type_of_invoice == "bill") {
		cur_frm.clear_table("payment_schedule");
		cur_frm.refresh_field("payment_schedule");

		// add number of days difined in defined_grace_period
		var someDate = new Date();
		someDate.setDate(someDate.getDate() + defined_grace_period);
		cur_frm.set_value("due_date", someDate)
	}
	else {
		// do nothing because the date is already set
	}
}


// function that sets the general customer details
function set_general_details(data) {
	cur_frm.set_value("area", data.message.area);
	cur_frm.set_value("zone", data.message.zone);
	cur_frm.set_value("route", data.message.route);
	cur_frm.set_value("tariff_category", data.message.customer_type);
	cur_frm.set_value("disconnection_profile", data.message.disconnection_profile);
	cur_frm.set_value("tel_no", data.message.tel_no);
	cur_frm.set_value("account_no", data.message.new_account_no);
	cur_frm.set_value("territory", data.message.territory);
}

// function that adds rows to the items child table
function add_row_and_values(i, list_of_items, units_within_category) {
	cur_frm.grids[0].grid.add_new_row(null, null, false);
	cur_frm.refresh_field("items");

	if (list_of_items[i].name == defined_flat_rate) {
		take_units(1)
	}
	else {
		take_units(units_within_category)
	}

	function take_units(units_within_category) {
		var newrow = cur_frm.grids[0].grid.grid_rows[cur_frm.grids[0].grid.grid_rows.length - 1].doc;
		newrow.item_code = list_of_items[i].name
		newrow.qty = units_within_category
		newrow.item_name = list_of_items[i].name
		newrow.description = list_of_items[i].name
		newrow.uom = 'm3'
		newrow.income_account = "Cost of Goods Sold - UL"
		newrow.uom_conversion_factor = 1
	}

}


// functions that adds the meter rent based on the type of customer
function add_meter_rent(tariff_category) {

	// get customer meter type
	frappe.call({
		"method": "frappe.client.get_list",
		args: {
			doctype: "Item",
			filters: {
				type_of_customer: cur_frm.doc.tariff_category,
				type_of_item: "Meter"
			},
			fields: ["name"]
		},
		callback: function (response) {
			// add a new row for meter rent
			cur_frm.grids[0].grid.add_new_row(null, null, false);
			cur_frm.refresh_field("items");
			var newrow = cur_frm.grids[0].grid.grid_rows[cur_frm.grids[0].grid.grid_rows.length - 1].doc;
			newrow.item_code = response.message[0].name
			newrow.qty = 1
			newrow.item_name = response.message[0].name
			newrow.description = response.message[0].name
			newrow.uom = 'm3'
			newrow.income_account = "Cost of Goods Sold - UL"
			newrow.uom_conversion_factor = 1

			// once the meter rent row and value is set save the form
			cur_frm.save()
		}
	});

}


// function that loops through the list of tarifs and find 
// those applicable to the consumption
function loop_through_tariffs(response) {
	cur_frm.clear_table("items");
	cur_frm.refresh_field("items");

	// sort the values using max value
	var list_of_items = response.message
	list_of_items.sort(function (a, b) { return a.max_quantity - b.max_quantity });

	// looping throough list of items(tarifs)
	for (var i = 0; i < list_of_items.length; i++) {
		var current_item = list_of_items[i]
		if (cur_frm.doc.consumption) {
			if (cur_frm.doc.consumption >= current_item.min_quantity) {
				var units_within_category = cur_frm.doc.consumption - current_item.min_quantity
				console.log("units within category")
				console.log(current_item)
				console.log(units_within_category)
				if (units_within_category > 0) {
					if (units_within_category >= current_item.difference_btw_max_and_min) {
						add_row_and_values(i, list_of_items, current_item.difference_btw_max_and_min)
					}
					else {
						console.log("Going for the final row")
						add_row_and_values(i, list_of_items, units_within_category + 1)
					}
				}
				else if (units_within_category == 0 && current_item.name == defined_flat_rate) {
					add_row_and_values(i, list_of_items, current_item.difference_btw_max_and_min)
				}
				else {
					// do nothing because not units are found within category
				}
			}
		}
		else {
			alert_message("Consumption is Not Given")
		}

	}

	// add meter rent here
	add_meter_rent(cur_frm.tariff_category)
}


/* function that creates a new sales invoice once the current one is saved
allowing it to loop through all the list of customer e.g from meter reading
sheet from meter reading capture list*/
function get_the_next_customer() {
	frappe.ui.form.on("Sales Invoice", {
		after_save: function () {
			var routeandperiod = cur_frm.doc.route + ' ' + cur_frm.doc.billing_period;

			frappe.call({
				"method": "frappe.client.get",
				args: {
					doctype: "Meter Reading Capture",
					name: routeandperiod
				},
				callback: function (data) {
					var meter_reading_sheet_table = data.message.meter_reading_sheet
					if (rowcount < meter_reading_sheet_table.length - 1) {
						var current_customer_details = meter_reading_sheet_table[rowcount]
						frappe.route_options = {
							"previous_reading": current_customer_details.previous_manual_reading,
							"current_reading": current_customer_details.current_manual_readings,
							"consumption": current_customer_details.manual_consumption,
							"type_of_bill": current_customer_details.type_of_bill,
							"billing_period": cur_frm.doc.billing_period,
							"type_of_invoice": "bill",
							"customer": current_customer_details.customer_name,
							"tariff_category": current_customer_details.type_of_customer,
							"from_finish_capture": "true"
						}

						frappe.set_route("Form", "Sales Invoice", "New Sales Invoice currentrow")
						rowcount += 1
					}

				}
			});
		}
	});
}


/*function that sets the customer details when sales invoice
form is opened*/
function set_customer_details() {
	frappe.call({
		"method": "frappe.client.get",
		args: {
			doctype: "Customer",
			filters: { "Name": cur_frm.doc.customer }
		},
		callback: function (data) {
			console.log("customer name")
			console.log(cur_frm.doc.customer)
			set_general_details(data) /* set customer details and readings*/

			// check if from finish capture
			if (cur_frm.doc.from_finish_capture) {
				console.log("yes from finish capture")
				add_items() /*add values to child table items*/
				get_the_next_customer()/* get the next customer from meter reading capture*/
			}
			else {
				console.log("not defined")
			}

		}
	})
}

// function that loops through the list of items and finds 
// those that are apllicable
function loop_through_tariff_items(response) {
	// cur_frm.clear_table("items");
	// cur_frm.refresh_field("items");

	// sort the values using max value
	var list_of_items = response.message
	list_of_items.sort(function (a, b) { return a.max_quantity - b.max_quantity });

	// looping throough list of items(tarifs)
	for (var i = 0; i < list_of_items.length; i++) {
		var current_item = list_of_items[i]
		if (cur_frm.doc.consumption) {
			if (cur_frm.doc.consumption >= current_item.min_quantity) {
				var units_within_category = cur_frm.doc.consumption - current_item.min_quantity
				console.log("units within category")
				console.log(current_item)
				console.log(units_within_category)
				if (units_within_category > 0) {
					if (units_within_category >= current_item.difference_btw_max_and_min) {
						add_row_and_values(i, list_of_items, current_item.difference_btw_max_and_min)
					}
					else {
						console.log("Going for the final row")
						add_row_and_values(i, list_of_items, units_within_category + 1)
					}
				}
				else if (units_within_category == 0 && current_item.name == defined_flat_rate) {
					add_row_and_values(i, list_of_items, current_item.difference_btw_max_and_min)
				}
				else {
					// do nothing because not units are found within category
				}
			}
		}
		else {
			alert_message("Consumption is Not Given")
		}

	}

	// add meter rent here
	add_meter_rent(cur_frm.tariff_category)
}


function loop_thro(frm){
	if(frm.doc.type_of_customer == "Domestic"){
		frappe.call({
			"method": "frappe.client.get_list",
			args: {
				doctype: "Item",
				filters: {
					type_of_customer:frm.doc.type_of_customer,
					type_of_item:frm.doc.type_of_invoice
				},
				fields: ["*"]
			},
			callback: function (response) {

			}
		})
	}
}


// functions that adds rows
function add_rows(frm,row_number, current_item_name){
	// clear the child table items
	cur_frm.clear_table("items");
	cur_frm.refresh_field("items");

	var l = [
		[
			{column_title:"item_code",column_value:"Deposit(Domestic)"},
			{column_title:"qty",column_value:1}
		],
		[
			{column_title:"item_code",column_value:"Deposit(Domestic)"},
			{column_title:"qty",column_value:1}
		]
	]

	// for(var i = 0; i<l.length;i++){
		
		add_one_row_and_value(frm,l)
	// }

	// function that add a row and corresping values
	function add_one_row_and_value(frm,current_row){
		console.log("adding rows")
		var new_row = frm.grids[0].grid.add_new_row(null, null, false);
		cur_frm.refresh_field("items");

		// new_row[column_title] = column_value
		new_row["item_code"] ="Deposit(Commercial)" 
		new_row["qty"] = 2
		new_row["item_name"] = "Deposit(Commercial)"
		new_row["description"] = "Deposit(Commercial)"
		new_row["uom"] = "Nos"
		new_row["income_account"] = "Cost of Goods Sold - UL"
		new_row["conversion_factor"] = 1

		// newrow.item_code = list_of_items[i].name
		// newrow.qty = units_within_category
		// newrow.item_name = list_of_items[i].name
		// newrow.description = list_of_items[i].name
		// newrow.uom = 'm3'
		// newrow.income_account = "Cost of Goods Sold - UL"
		// newrow.uom_conversion_factor = 1
		
		// for(var i = 0;i<current_row.length;i++){
		// 	var column_title = current_row[i]["column_title"]
		// 	var column_value = current_row[i]["column_value"]

		// 	new_row[column_title] = column_value
		// 	ne
		// 	new_row["item_name"] = ""
		// 	new_row["UOM"] = "Nos"
		// }
		cur_frm.refresh_field("items");
	}
}

// function that gets applicable items
function get_items(frm) {
	// check is tariff category is defined
	return new Promise((resolve, reject) => {
		frappe.call({
			"method": "frappe.client.get_list",
			args: {
				doctype: "Item",
				filters: {
					type_of_customer:frm.doc.type_of_customer,
					type_of_item:frm.doc.type_of_invoice
				},
				fields: ["*"]
			},
			callback: function (response) {
				if (response.message.length > 0) {
					resolve({ "status": true, message: response })
				}
				else {
					var message = "No Applicable Items were found for this customer type and invoice"
					resolve({ "status": false, message:message})
				}
			}
		});
	});
}

// function that checks that all the required fields are filled
function check_required_fields(frm) {
	if (frm.doc.type_of_invoice == "Bill") {
		var required_fields = required_fields_for_each_invoice["bill"]
		return looping_function(frm, required_fields)
	}
	else if (frm.doc.type_of_invoice == "Deposit") {
		var required_fields = required_fields_for_each_invoice["deposit"]
		var test_var = looping_function(frm, required_fields)
		return looping_function(frm, required_fields)
	}
	else if (frm.doc.type_of_invoice == "New Connection Fee") {
		var required_fields = required_fields_for_each_invoice["new_connection_fee"]
		return looping_function(frm, required_fields)
	}
	else if (frm.doc.type_of_invoice == "Penalty") {
		var required_fields = required_fields_for_each_invoice["penalty"]
		return looping_function(frm, required_fields)
	}
	else if (frm.doc.type_of_invoice == "Other") {
		var required_fields = required_fields_for_each_invoice["other"]
		return looping_function(frm, required_fields)
	}
	else {
		return { "status": false, "field": "Something Went Wrong while Checking, please ensure all the fields are available" }
	}

	/*function that loops through each function*/
	function looping_function(frm, required_fields) {
		for (var i = 0; i < required_fields.length; i++) {
			var current_field = required_fields[i]
			var if_field = check_field_filled(frm, current_field)
			if (if_field) {
				// continue
			}
			else {
				alert_message("Please fill the field " + current_field)
				return { "status": false, "field": current_field }
			}
		}
		// if all the fields are available
		return { "status": true }
	}

	/* function that checks if each field is filled or empty*/
	function check_field_filled(frm, field_name) {
		var my = field_name

		if (String(frm.doc[my]).length) {
			return true
		}
		else {
			return false
		}
	}
}


/*function that hides fields ,called on refresh*/
function hide_unhide_fields(frm, list_of_fields, hide_or_unhide) {
	for (var i = 0; i < list_of_fields.length; i++) {
		frm.toggle_display(list_of_fields[i], hide_or_unhide)
	}
}


// function that hides or unhides certain fields on refresh
function hide_unhide_on_refresh(frm) {
	console.log("On refresh")
	if (frm.doc.type_of_invoice == "Bill") {
		hide_function(frm, field_to_hide_unhide, "bill")
	}
	else if (frm.doc.type_of_invoice == "Deposit") {
		hide_function(frm, field_to_hide_unhide, "deposit")
	}
	else if (frm.doc.type_of_invoice == "New Connection Fee") {
		hide_function(frm, field_to_hide_unhide, "new_connection_fee")
	}
	else if (frm.doc.type_of_invoice == "Penalty") {
		hide_function(frm, field_to_hide_unhide, "penalty")
	}
	else if (frm.doc.type_of_invoice == "Other") {
		hide_function(frm, field_to_hide_unhide, "other")
	}
	else {
		hide_function(frm, field_to_hide_unhide, "none")
	}

	function hide_function(frm, field_to_hide_unhide, type_of_invoice) {
		var hide_fields = field_to_hide_unhide["all"]
		var unhide_fields = field_to_hide_unhide[type_of_invoice]
		if (type_of_invoice == "none") {
			hide_unhide_fields(frm, hide_fields, false)
		}
		else {
			hide_unhide_fields(frm, hide_fields, false)
			hide_unhide_fields(frm, unhide_fields, true)
		}
	}
}

// function that creates the sales invoice based on the type of invoice
// it is called when all the required fields have been filled
function collect_items(frm) {
	console.log("collect items")
	if (frm.doc.type_of_invoice == "Bill") {
		// do nothing for now
	}
	else if (frm.doc.type_of_invoice == "Deposit") {
		var type_of_customer = frm.doc.type_of_customer
		console.log("type of customer")
		return true
	}
	else if (frm.doc.type_of_invoice == "New Connection Fee") {

	}
	else if (frm.doc.type_of_invoice == "Penalty") {

	}
	else if (frm.doc.type_of_invoice == "Other") {

	}
	else {
		console.log("Something went wrong with the check_required_details function")
	}
}

/* end of the general functions section
// =================================================================================================
/* This section  contains functions that are triggered by the form action refresh or
reload to perform various action*/

/* end of the form triggered functions section
// =================================================================================================
/*function that acts when the readings field under meter reading sheet is
filled*/


// function that runs on refresh
frappe.ui.form.on("Sales Invoice", "refresh", function (frm) {
	console.log("Refreshing !")
	hide_unhide_on_refresh(frm)

	// customer_field()
	// type_of_invoice_clicked(frm)
})

// function that runs when the type_of_invoice field is clicked
frappe.ui.form.on("Sales Invoice", "type_of_invoice", function (frm) {
	frm.refresh()

})

// function that runs when the collect items button is clicked
frappe.ui.form.on("Sales Invoice", "collect_items", function (frm) {
	// checks that all fields are fields
	/*
	new Promise((resolve, reject) => {
		resolve(check_required_fields(frm))
	})
	.then((x)=>{
		// get applicable sales items
		if(x.status = true){
			return get_items(frm)
		}
		else if(x.status = false){
			alert_message(x.message)
		}
	})
	.then((x)=>{
		// filter applicable items
		console.log(x)
		add_rows(frm,0, "Deposit(Domestic)")
	})*/

	// cur_frm.grids[0].grid.add_new_row(null, null, false);
	// cur_frm.refresh_field("items");

	/*
	var new_row = frm.grids[0].grid.add_new_row(null, null, false);
	// new_row[column_title] = column_value
	new_row["item_code"] ="Deposit(Commercial)" 
	new_row["rate"] = 10
	new_row["qty"] = 2
	new_row["item_name"] = "Deposit(Commercial)"
	new_row["description"] = "Deposit(Commercial)"
	new_row["uom"] = "Nos"
	new_row["income_account"] = "Cost of Goods Sold - UL"
	new_row["conversion_factor"] = 1

	total_qt
	cur_frm.refresh_field("items");
	*/
});

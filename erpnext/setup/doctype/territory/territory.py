# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe


from frappe.utils import flt
from frappe import _

from frappe.utils.nestedset import NestedSet

class Territory(NestedSet):
	nsm_parent_field = 'parent_territory'

	def validate(self):
		for d in self.get('targets') or []:
			if not flt(d.target_qty) and not flt(d.target_amount):
				frappe.throw(_("Either target qty or target amount is mandatory"))
		
		# capitalize the name
		capitalized_name = parse_names(self.name)
		self.actual_territory_name = capitalized_name

		# give territory the correct type
		parent_and_route = {"Country":"Area","Area":"Zone","Zone":"Route"}
		list_of_parents = frappe.get_list("Territory",
			fields=["name","type_of_territory","parent_territory"],
			filters = {
				"name":self.parent_territory
		})
		
		if(len(list_of_parents) == 0):
			frappe.throw("No Such Parent")
		else:
			# get the first parent
			list_of_parents[0].type_of_territory
			supposed_parent = parent_and_route[list_of_parents[0].type_of_territory]
			if(self.type_of_territory == supposed_parent):
				# the parent is correct
				pass
			else:
				frappe.throw("Please Change the Type of Territory to {}".format(supposed_parent))


		# check if Territory type is route
		if(self.type_of_territory != "Route"):
			# check if zone is group
			if(self.is_group == 0):
				frappe.throw("{} Should be of Territory Type Group".format(self.type_of_territory))
			else:
				# pass because territory is group and hence correct
				pass
		else:
			# if parent type is Route ensure it not a group
			if(self.is_group == 1):
				frappe.throw("A Route Cannot be a Group")
			else:
				# its not a group hence pass
				pass

			# check if its only one route under the territory
			list_of_territories = frappe.get_list("Territory",
				fields=["name"],
				filters = {
					"parent_territory":self.parent_territory
			})

			if(len(list_of_territories)== 0):
				# Add a custom name for Route
				self.name = str(self.parent_territory +" - R")
			else:
				# check if its an update
				if(list_of_territories[0].name == self.name):
					# ensure that name is the same
					self.name = str(self.parent_territory +" - R")
					self.is_group = 0
					pass
				else:
					frappe.throw("You Can Only Have One Route Under A Zone")

		'''
		The code below was supposed to allow territories to have the same 
		name but it is currently commented out because it does not work
		'''
		# check if Territory is already saved
		# if(self.saved == "yes"):
		# 	# do nothing
		# 	pass
		# else:
		# 	self.saved = "yes"
		# 	if(self.parent_territory):
		# 		territory_available = check_territory_availability(capitalized_name,self.parent_territory)
				
		# 		if(territory_available["status"]):
		# 			if(territory_available["message"]=="Duplicate"):
		# 				frappe.throw("Duplicate Territory Name")
		# 			elif(territory_available["message"]=="Similar"):
		# 				# create territory and append parent name
		# 				print "new territory"
		# 				self.territory_name = capitalized_name + "-"+self.parent_territory
		# 				self.name = capitalized_name + "-"+self.parent_territory
		# 		else:
		# 			# create territory
		# 			self.territory_name = capitalized_name
		# 			self.name = capitalized_name
		# 	else:
		# 		# no parent exist yet hence this the the initial setup
		# 		pass

	def on_update(self):
		super(Territory, self).on_update()
		self.validate_one_root()

def on_doctype_update():
	frappe.db.add_index("Territory", ["lft", "rgt"])

def parse_names(given_name):
	'''
	Function that parses the name to give the format
	by getting rid of underscores
	eg.
		input:
			"area a"
		output:
			Area A
	'''
	split_name = given_name.split(" ")
	full_word = ''
	for part in split_name:
		if split_name.index(part) == 0:
			full_word += part.capitalize()
		else:
			full_word +=" "
			full_word += part.capitalize()
	return full_word

def check_territory_availability(territory_name,parent_territory):
	'''
	Function that checks for the availbility territories
	arg:
		territory name, parent territory
	output:
		{"status":True,"message":message} 
        or
        {"status":True,"message":message}
    '''
	# get list of territories matching creteria
	results = frappe.get_list("Territory",
			fields=["*"],
			filters = {
				"territory_name":territory_name,
				"parent_territory":parent_territory
			}
	)

    # get list of territories matching creteria from different 
    # parent
	other_results = frappe.get_list("Territory",
            fields=["*"],
            filters = {
				"territory_name":territory_name,
                "parent_territory":("!=",parent_territory)
			}
    )

	if(len(results)==0):
		# no duplicate name undersame parent
		if(len(other_results)==0):
			# no territory from other parents have name
			return {"status":False}
		else:
			# territories from other parents have name
			return {"status":True, "message":"Similar"}
	else:
		# duplicate under the same name
		return {"status":True , "message":"Duplicate"}

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

		print "*"*80
		# capitalize the name
		capitalized_name = parse_names(self.name)
		self.actual_territory_name = capitalized_name

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

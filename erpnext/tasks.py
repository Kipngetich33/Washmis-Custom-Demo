from __future__ import unicode_literals

import requests
import frappe
import frappe.defaults


def main_function():
    '''
    This is the main function that calls all the 
    other task functions
    '''
    '''
    #pull data from ona Test form
    recieved_data = pull_from_ona()
    #process the data
    processed_data = process_pulled_data(recieved_data)
    #update system values
    update_system_values(recieved_data)

    # pull from ona Rujuwasco form
    '''
    # form_id = 374744
    form_id = 290920
    current_start = get_last_system_values(form_id)
    pulled_data = pull_from_ona()

    # pulled_data = pulled_data[14964]

    i = 0 
    for record in pulled_data:
        i += 1
        print "index"
        print i


        # due to many issues comment out the create/update terriroy section below
        '''
        # get area and zone       
        current_area = record["service_area_details/region_name"]
        current_zone_key = "service_area_details/"+current_area
        current_zone = record[current_zone_key]

        # check if the current area exists
        parse_area_name = parse_names(current_area)
        parse_zone_name = parse_names(current_zone)
        area_available = check_territory_availability(parse_area_name,"Kenya")

        if(area_available):
            print "already available"
            # do nothing
            pass
        else:
            print "creating territoy"
            # create the area
            create_territory(parse_area_name,"Area","Kenya")

        # check if the current zone exists
        zone_available = check_territory_availability(parse_zone_name,parse_area_name)
        if(zone_available):
            print "Zone already available"
            # do nothing
            pass
        else:
            print "creating zone"
            # create the zone
            create_territory(parse_zone_name,"Zone",parse_area_name)
        '''
        
        # create or update account section below
        pass


# Adding tasks to run periodically
def pull_from_ona():
    '''
    Function that pulls data from the ona form and 
    returns result in json format
    '''
    print "*"*80
    print "Pulling data from ona"
    form_id = 296224
    # determine next starting point
    current_start = get_last_system_values(form_id)
    # print current_start
    # if(len(current_start)>0):
    #     current_start_value = current_start[0]["int_value"]
    # else: 
    #     current_start_value = 0

    # test form id = 374744
    url = "https://api.ona.io/api/v1/data/{}?start={}".format(form_id,current_start)
    response = requests.get(url,auth=("upande", "upandegani"))
    retrived_form_data = response.json()
    return retrived_form_data

def process_pulled_data(pulled_data):
    '''
    Function that process the data pulled from ona form
    add functionality to ensure that get rid of duplicates -
    this functionality should be added to controllers 
    Input:
        pulled data from ona
    output:

    '''
    '''
    print data
    if(len(data)>0):
        for record in data:
            current_record_details = {}
            current_record_details["customer_name"] = parse_names(record["customer_name"])
            current_record_details["customer_group"] = parse_names(record["customer_group"])
            current_record_details["territory"] = parse_names(record["territory"])
            current_record_details["area"] = parse_names(record["area"])
            current_record_details["zone"] = parse_names(record["zone"])
            current_record_details["route"] = parse_names(record["route"])

            # save each customer_details
            save_new_customer_details(current_record_details)

        return data
    else:
        print "No new data from ona form"
    '''

    if(len(pulled_data)>0):
        for record in pulled_data:
            #call functionality to check data
            check_pulled_data(record)

def parse_names(given_name):
    '''
    Function that parses the name to give the 
    format by getting rid of underscores
    eg.
        input:
            "area_a"
        output:
            Area A
    '''
    split_name = given_name.split("_")
    print split_name
    full_word = ''
    for part in split_name:
        if split_name.index(part) == 0:
            print part
            full_word += part.capitalize()
        else:
            print part
            full_word +=" "
            full_word += part.capitalize()
    print "full word"
    print full_word
    return full_word

def save_new_customer_details(data):
    '''
    Function that saves the customer details
    '''
    print "saving customer details"
    current_customer= frappe.get_doc({
        "doctype":"Customer",
        "customer_name":data["customer_name"],
        "customer_group":data["customer_group"],
        "territory":data["territory"],
        "area":data["area"],
        "zone":data["zone"],
        "route":data["route"]
	})
    current_customer.insert()


def update_system_values(data,form_id):
    '''
    Function that update the system values 
    to determine the next start of the 
    pull_from_ona function
    input:
        list of pulled data from ona
    output:
        None
    '''
    number_of_new_items = len(data)
    #the the last system value for pulled data
    last_system_values = get_last_system_values(form_id)  

    if(last_system_values == 0):
        #create a new system values
        new_system_value = frappe.get_doc({
			"doctype":"System Values",
            "target_document":"pull_from_ona",
			"int_value":number_of_new_items
		})
        new_system_value.insert()

    else:
        #update the integer value
        existing_system_values = frappe.get_doc("System Values",last_system_values[0].name)
        existing_system_values.int_value = int(last_system_values[0]["int_value"])+number_of_new_items
        existing_system_values.save()


# functions for Rujuwasco Data
def get_last_system_values(form_id):
    '''
    Function that gets the last system values for
    pull_from_ona
    output:
        a list of system values objects i.e [<system values obj..>,..]
    '''
    last_system_values = frappe.get_list("System Values",
        fields=["*"],
        filters = {
            "target_document":"pull_from_ona",
            "target_record":form_id
        }
    )
    if(len(last_system_values)==0):
        return 0
    else:
        return last_system_values[0]["int_value"]    


def create_new_account(account_name,company_name):
    '''
    Function that creates a new customer account
    arg:
        Customer Name
    '''
    new_account = frappe.get_doc({"doctype":"Account"})
    new_account.account_name = account_name
    new_account.account_number = generate_account_number()
    new_account.company = company_name
    new_account.parent_account = "Accounts Receivable - UL"
    new_account.root_type = "Asset"
    new_account.insert()


def generate_account_number():
    '''
    Function that generated a new customer
    account number under account  recievables
    for unverified accounts
    '''
    # get the name of system values for account recivables
    system_values_accounts = frappe.get_list("System Values",
            fields=["*"],
            filters = {
				"target_document": "Account",
				"target_record":"Accounts Receivable"
			}
    )

    if(len(system_values_accounts)== 0):
        # create new system values
        new_system_values_account = frappe.get_doc({"doctype":"System Values"})
        new_system_values_account.target_document = "Account"
        new_system_values_account.target_record = "Accounts Receivable"
        new_system_values_account.int_value = 1
        new_system_values_account.insert()
        return 1 

    else:
        # get int value and generate new account
        last_system_value = system_values_accounts[0].int_value
        #update the system value by adding one to previous value
        last_system_value +=1
        new_system_value = frappe.get_doc("System Values", system_values_accounts[0].name)
        new_system_value.int_value = last_system_value
        new_system_value.save()
        return last_system_value


def check_account_availablity(account_number):
    '''
    Function that checks if a customer account exists 
    under accounts recievables
    '''
    account_number = 5
    # get the name of system values for account recivables
    available_accounts = frappe.get_list("Account",
            fields=["*"],
            filters = {
				"account_number": account_number
			}
    )
    if(len(available_accounts)==0):
        return False
    else:
        return True

def create_territory(territory_name,territory_type,parent_territory):
    '''
    Function that creates a new territory and places
    it under the correct parent using the type_of_territory
    args:
        example:
            territory_name = "Nairobi"
            territory_type ="Area"
            parent_territory = "Kenya"
    '''
    is_group = 1
    if(territory_type == "Route"):
        is_group = 0

    # get ancestral territory
    if(parent_territory == "Kenya" ):
        ancestral_territory = "All Territories"
    else:
        ancestral_territory = "Kenya"

    # get the correct parent territory name
    results = frappe.get_list("Territory",
            fields=["*"],
            filters = {
				"territory_name":parent_territory,
                "parent_territory":ancestral_territory
			}
        )
    parental_territory_name = results[0]["name"]

    new_territory = frappe.get_doc({"doctype":"Territory"})
    # append the type of territory to the end of the name
    new_territory.territory_name = territory_name
    new_territory.type_of_territory = territory_type
    new_territory.parent_territory = parental_territory_name
    new_territory.is_group = is_group
    new_territory.insert()


def check_territory_availability(territory_name,parent_territory):
    '''
    Function that checks for the availbility territories
    arg:
        territory name, parent territory 
    output:
        {"status":True,"message":message} 
        or
        {"status":False}
    '''

    territory_name = "Route 1.1"
    parent_territory = "Area A"
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
            return {"status":"False"}
        else:
            # territories from other parents have name
            return {"status":True, "message":"Similar"}
    else:
        # duplicate under the same name
        return {"status":True , "message":"Duplicate"}
   
def availability_of_territory_with_appended_parent():
    '''
    Function that checks the availability of a territory
    even when there is an appended parent using 
    actual_territory_name field
    '''
    pass


def create_survey_data(matching_fields):
    '''
    Function that creates a new survey data 
    record for a given customer in the format 
    below
    example:

    matching_fields = {
        "customer_name":"Some Customer name",
        "connection_with_the_company":"Connected",
        "the_status_of_the_connection_is_correct":1,
        "type_of_sanitation":"Sewered"
    }
    '''
    # create leads
    new_survey = frappe.get_doc({"doctype":"Survey Data"})
    new_survey.connection_with_the_company = matching_fields["connection_with_the_company"]
    new_survey.the_status_of_the_connection_is_correct = matching_fields["the_status_of_the_connection_is_correct"]
    new_survey.type_of_sanitation = matching_fields["type_of_sanitation"]
    new_survey.insert()


def check_availability_survey(customer_name):
    '''
    Check the availability of survey data of a
    given customer
    arg:
        customer_name
    output:
        True/False
    '''
    # get list of territories matching creteria
    results = frappe.get_list("Survey Data",
            fields=["*"],
            filters = {
                "customer_name":customer_name
			}
    )
    if(len(results)==0):
        return False
    else:
        return True



def create_meter_serial_no(matching_fields,type_of_premise):
    '''
    function that creates a new serial number for meter
    '''
    
    # create gis _data 
    new_serial_number = frappe.get_doc({"doctype":"Serial No"})
    new_serial_number.item_code = "Test Meter"
    new_gis_data.customer_name = matching_fields["customer_name"]
    new_gis_data.meter_state = matching_fields["meter_state"]
    new_gis_data.meter_serial_no = matching_fields["meter_serial_no"]
    new_gis_data.gps_coordinate_of_the_meter_x = matching_fields["gps_coordinate_of_the_meter_x"]
    new_gis_data.insert()

    # save serial numbers based on the customer group category
    item_customer_group = {
        "domestic/residential/mixed":"Domestic Meter T",
        "commercial_premise":"Commercial Meter T",
        "industrial_premise":"Industrial T",
        "institution_premise":"Schools and Institutions T",
        "ablution_block":"Ablution Block T",
        "kiosk":"Kiosk T"
    }

def check_serial_no_availablity(serial_no):
    '''
    Function that checks the availability of 
    meter serial numbers
    '''
    # get list of serial numbers matching the given serial_no
    results = frappe.get_list("Serial No",
            fields=["*"],
            filters = {
                "name":serial_no
			}
    )
    if(len(results)==0):
        return False
    else:
        return True

def fetch_meter_serial_from_cust(customer_name):
    '''
    Function that survey GIS to find out if a
    customer has been issued with a meter
    input:
        customer_name
    Output:
        serial_number (int) or None if none exists
    '''
    customer_name = "Test 3"
    # get list of territories matching creteria
    results = frappe.get_list("GIS Data",
            fields=["*"],
            filters = {
                "customer_name":"Test 3"
			}
    )
    return  results[0]["meter_serial_no"]


def check_serial_system():
    '''
    Function that checks if a system value for
    serial exist and create one if none exist
    '''
    last_system_values = frappe.get_list("System Values",
        fields=["*"],
        filters = {
            "target_document":"serial_no",
        }
    )
    if(len(last_system_values)==0):
        return 0
    else:
        return last_system_values[0]["int_value"]

def update_serial_system_values():
    last_system_values = frappe.get_list("System Values",
        fields=["*"],
        filters = {
            "target_document":"Serial No",
        }
    )

    if(len(last_system_values)==0):
        #create a new system values
        new_system_value = frappe.get_doc({
			"doctype":"System Values",
            "target_document":"Serial No",
			"int_value":1
		})
        new_system_value.insert()

    else:
        #update the integer value
        existing_system_values = frappe.get_doc("System Values",last_system_values[0].name)
        existing_system_values.int_value = int(last_system_values[0]["int_value"])+1
        existing_system_values.save()

def create_gis_data(matching_fields):
    '''
    Function that creates a new GIS data 
    record for a given customer in the format 
    below
    example:
    matching_fields = {
        "customer_name":"Test 3",
        "meter_state":"Working",
        "meter_serial_no":124325432643,
        "gps_coordinate_of_the_meter_x":"123214 -21134 38"
    }
    '''
    # create gis _data 
    new_gis_data = frappe.get_doc({"doctype":"GIS Data"})
    new_gis_data.customer_name = matching_fields["customer_name"]
    new_gis_data.meter_state = matching_fields["meter_state"]
    new_gis_data.meter_serial_no = matching_fields["meter_serial_no"]
    new_gis_data.gps_coordinate_of_the_meter_x = matching_fields["gps_coordinate_of_the_meter_x"]
    new_gis_data.insert()

def check_availability_gis(customer_name):
    '''
    Check the availability of GIS data of a
    given customer
    arg:
        customer_name
    output:
        True/False
    '''
    # get list of territories matching creteria
    results = frappe.get_list("GIS Data",
            fields=["*"],
            filters = {
                "customer_name":customer_name
			}
    )
    if(len(results)==0):
        return False
    else:
        return True


def create_leads(matching_fields):
    '''
    Function that creates leads based on the given 
    fields as an object in the followin format:
        matching_fields = {
            "lead_name":"Some name", #customer name
            "new_connection": "Willing to be connected/not willing",
            "region":"Test Region",
            "zone":"Test Zone",
            "landlord_first_name":"Some name",
            "landlord_middle_name":"Some name",
            "landlord_surname":"Some name",
            "plot_no":"Some name",
            "landlord_phone_number_":"Some name",
            "mobile_no":"Some name", #customer phone number
            "type_of_sanitation":"Some name",
            "gps_location":"Some name",
        }
    '''

    # create leads
    new_lead = frappe.get_doc({"doctype":"Lead"})
    new_lead.lead_name = matching_fields["lead_name"]
    new_lead.new_connection = matching_fields["new_connection"]
    new_lead.region = matching_fields["region"]
    new_lead.zone = matching_fields["zone"]
    new_lead.landlord_first_name = matching_fields["landlord_first_name"]
    new_lead.landlord_middle_name = matching_fields["landlord_middle_name"]
    new_lead.landlord_surname = matching_fields["landlord_surname"]
    new_lead.plot_no = matching_fields["plot_no"]
    new_lead.landlord_phone_number_ = matching_fields["landlord_phone_number_"]
    new_lead.mobile_no = matching_fields["mobile_no"]
    new_lead.type_of_sanitation = matching_fields["type_of_sanitation"]
    new_lead.gps_location =  matching_fields["gps_location"]
    new_lead.insert()

# def check_lead_availability(person_name):
def check_lead_availability():
    '''
    Function that checks if a certain lead is available 
    based on the person's name
    '''
    person_name = "S"
    # get list of territories matching creteria
    results = frappe.get_list("Lead",
            fields=["*"],
            filters = {
                "lead_name":person_name
			}
    )
    if(len(results)==0):
        return False
    else:
        return True
    

    


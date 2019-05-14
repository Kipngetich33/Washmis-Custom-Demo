import requests

def get_gis():
    serial = "27D14BE027630Y"
    url = 'http://gis.washmis.com/geoserver/ows?service=wfs&version=1.1.0&typename=geonode:kewasco_master_meters&request=getfeature&cql_filter=serial_no=%{}%27&outputFormat=json'.format(serial)
    response = requests.get(
        url,
        auth=('admin_kewasco', 'pw4kewasco')
    )
    return response

def get_serial_numbers():
    url = "http://gis.washmis.com/geoserver/ows?service=wfs&version=1.1.0&typename=geonode:kewasco_master_meters&request=getfeature&outputFormat=json"
    response = requests.get(
        url,
        auth=('admin_kewasco', 'pw4kewasco')
    )

    return response


def process_data():
    gis_data= get_serial_numbers().json()
    
    # get the features
    all_features = gis_data["features"]

    # loop through all features
    for feature in all_features:
        pass

    print gis_data
    print type(gis_data)
    return gis_data
    

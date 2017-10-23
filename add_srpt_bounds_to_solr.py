__author__ = 'chrissbarnett'

import pysolr
import json
import requests

# url to solr core
solr_url = 'http://host:port/solr/corename'

# if solr update is protected with basic auth, set 'auth' to True and set user and password
auth = False
user = 'user'
passwd = 'passwd'


def update_all_with_srpt():
    """
    update all solr documents with bounds_srpt field
    """
    update_batch(fl='LayerId,MinX,MaxX,MinY,MaxY,bounds_srpt', update_expr=add_srpt_expression)


def update_batch(fq=[], fl=None, update_expr=None, rows=100, start=0):
    solr = pysolr.Solr(solr_url)
    if not isinstance(fq, list):
        fq = [fq]

    ping = solr.search("*", fq=fq, fl=[], rows=0, start=start)
    hits = ping.hits
    print(hits)
    for i in range(start, hits, rows):
        print("start=" + str(i) + ' total=' + str(hits))
        if fl is None:
            resp = solr.search("*", fq=fq, rows=rows, start=i, sort='LayerId asc')
        else:
            resp = solr.search("*", fl=fl, fq=fq, rows=rows, start=i, sort='LayerId asc')

        do_update(resp, update_expr)


def do_update(resp, update_expr):
    docs = []
    update_sent = False
    for result in resp.docs:
        update_doc = update_expr(result)
        if update_doc is not None:
            docs.append(update_doc)
    try:
        if len(docs) > 0:
            if auth:
                r = requests.post(solr_url + '/update', json=docs, auth=(user, passwd))
            else:
                r = requests.post(solr_url + '/update', json=docs)
            print(r.text)
            print('added: ' + str(len(docs)))
            if r.status_code == 200:
                update_sent = True

    except Exception as e:
        print(e.message)
    if update_sent:
        commit()


def commit():
    commit_cmd = {'commit': {}}
    if auth:
        r = requests.post(solr_url + '/update', json=commit_cmd, auth=(user, passwd))
    else:
        r = requests.post(solr_url + '/update', json=commit_cmd)
    print(r.text)


def test_ybounds(val):
    return val <= 90 and val >= -90


def test_xbounds(val):
    return val <= 180 and val >= -180


def test_bounds(minx, maxx, miny, maxy):
    """
    ensure that the bounds are valid
    """
    if minx > maxx:
        print('MinX greater than MaxX')
        return False
    if miny > maxy:
        print('MinY greater than MaxY')
        return False
    return test_ybounds(miny) and test_ybounds(maxy) and test_xbounds(minx) and test_xbounds(maxx)


def add_srpt_expression(doc):
    """
    takes an ogp solr document, reads MinX, MinY, MaxX, MaxY and converts to a WKT ENVELOPE readable by an SRPT field.
    returns an update document.
    """
    if 'bounds_srpt' in doc:
        # skip if bounds_srpt is already in the document
        return None
    if 'MinX' not in doc or 'MinY' not in doc or 'MaxX' not in doc or 'MaxY' not in doc:
        print("Missing required field")
        print(doc)
        return None
    if not test_bounds(doc['MinX'], doc['MaxX'], doc['MinY'], doc['MaxY']):
        # skip if the bounds aren't valid
        return None

    update_field = 'bounds_srpt'
    field_val = 'ENVELOPE(' + str(doc['MinX']) + ', ' + str(doc['MaxX']) + ', ' + str(doc['MaxY']) + ', ' \
                + str(doc['MinY']) + ')'
    update_doc = {}
    update_doc['LayerId'] = doc['LayerId']
    update_doc[update_field] = {'set': field_val}
    return update_doc

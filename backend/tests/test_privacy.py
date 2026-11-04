from app.security_controls import SlidingWindowGuard


def auth(client, email):
    result=client.post('/api/auth/register',json={'email':email,'password':'very-strong-password-123'})
    assert result.status_code == 201, result.text
    return {'Authorization':'Bearer '+result.json()['access_token']}


def test_account_export_is_private_and_preserves_full_records(client):
    a=auth(client,'private-one@example.com')
    b=auth(client,'private-two@example.com')
    payload={'date':'2026-11-04','type':'Race','distanceMiles':3.10686,
             'durationSeconds':1200,'notes':'personal result'}
    assert client.post('/api/workouts',headers=a,json=payload).status_code==201
    assert client.get('/api/account/export').status_code==401
    data=client.get('/api/account/export',headers=a)
    assert data.status_code==200
    assert data.headers['cache-control']=='private, no-store'
    assert data.headers['x-content-type-options']=='nosniff'
    assert data.json()['email']=='private-one@example.com'
    assert data.json()['workouts'][0]['notes']=='personal result'
    assert client.get('/api/account/export',headers=b).json()['workouts']==[]


def test_account_deletion_rechecks_password_and_cascades(client):
    a=auth(client,'deletion-one@example.com')
    b=auth(client,'deletion-two@example.com')
    record={'date':'2026-11-04','type':'Easy','distanceMiles':5,
            'durationSeconds':2400,'notes':'private'}
    client.post('/api/workouts',headers=a,json=record)
    client.post('/api/workouts',headers=b,json=record)
    assert client.request('DELETE','/api/account',headers=a,json={'password':'incorrect','confirm':'DELETE MY ACCOUNT'}).status_code==403
    assert client.get('/api/workouts',headers=a).status_code==200
    assert client.request('DELETE','/api/account',headers=a,json={'password':'very-strong-password-123','confirm':'DELETE MY ACCOUNT'}).status_code==204
    assert client.get('/api/workouts',headers=a).status_code==401
    assert len(client.get('/api/workouts',headers=b).json())==1
    assert client.post('/api/auth/login',json={'email':'deletion-one@example.com','password':'very-strong-password-123'}).status_code==401


def test_sliding_window_limit_and_expiration():
    guard=SlidingWindowGuard()
    assert guard.allow('login:test',2,60,now=0)
    assert guard.allow('login:test',2,60,now=1)
    assert not guard.allow('login:test',2,60,now=2)
    assert guard.allow('login:test',2,60,now=61)


def test_api_request_budget_headers(client):
    response=client.get('/api/health')
    assert response.status_code==200
    assert response.headers['x-content-type-options']=='nosniff'
    assert response.headers['cache-control']=='private, no-store'

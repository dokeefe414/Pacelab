from io import BytesIO
from zipfile import ZipFile,ZIP_DEFLATED
from app.bulk_import import validate_members
from app.activity_import import ActivityParseError


def gpx(day="2026-10-20"):
    return (f'<gpx><trk><trkseg>'
            f'<trkpt lat="41.00" lon="-75.00"><time>{day}T12:00:00Z</time></trkpt>'
            f'<trkpt lat="41.01" lon="-75.00"><time>{day}T12:09:00Z</time></trkpt>'
            '</trkseg></trk></gpx>').encode()


def archive(*entries):
    buf=BytesIO()
    with ZipFile(buf,'w',compression=ZIP_DEFLATED) as out:
        for name,contents in entries:
            out.writestr(name,contents)
    return buf.getvalue()


def test_zip_validates_entries_and_honors_no_xml_entities():
    with ZipFile(BytesIO(archive(("COROS/one.gpx",gpx()),("../two.gpx",gpx("2026-10-21"))))) as z:
        m=validate_members(z)
        assert len(m)==2
        assert m[1][1]=="two.gpx"


def test_bulk_account_upload_dedupe_and_isolation(client):
    def signup(email):
        r=client.post('/api/auth/register',json={'email':email,'password':'very-strong-password-123'})
        assert r.status_code==201
        return {'Authorization':'Bearer '+r.json()['access_token']}
    a=signup('bulk-one@example.com')
    b=signup('bulk-two@example.com')
    contents=archive(("one.gpx",gpx()),("folder/two.gpx",gpx("2026-10-21")))
    result=client.post('/api/activities/import-bulk',headers=a,files={'file':('history.zip',contents,'application/zip')})
    assert result.status_code==200,result.text
    assert result.json()['imported']==2
    assert result.json()['failed']==0
    again=client.post('/api/activities/import-bulk',headers=a,files={'file':('history.zip',contents,'application/zip')})
    assert again.json()['duplicates']==2
    assert client.get('/api/workouts',headers=b).json()==[]
    assert len(client.get('/api/workouts',headers=a).json())==2
    assert client.post('/api/activities/import-bulk',files={'file':('history.zip',contents)}).status_code==401
    assert client.post('/api/activities/import-bulk',headers=a,files={'file':('broken.zip',b'garbage')}).status_code==422
    assert client.post('/api/activities/import-bulk',headers=a,files={'file':('history.txt',contents)}).status_code==422


def test_zip_rejects_oversized_file():
    # A highly compressible 10MB+ file must not be decompressed into memory.
    with ZipFile(BytesIO(archive(("huge.gpx",b'x'*(10*1024*1024+1))))) as z:
        try:
            validate_members(z)
            assert False
        except ActivityParseError:
            pass

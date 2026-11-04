"""Complete synthetic binary FIT smoke test through the actual fitdecode library.

This file constructs a tiny FIT stream from neutral artificial values.
No real COROS routes, timestamps, activity bytes, or identifiers are committed.
"""
from datetime import datetime, timezone
import struct

from app.activity_import import parse_activity

FIT_EPOCH = datetime(1989, 12, 31, tzinfo=timezone.utc)


def definition(local, global_number, fields):
    header=bytes([0x40|local])
    data=struct.pack("<BBHB",0,0,global_number,len(fields))
    return header+data+b"".join(struct.pack("<BBB",*field) for field in fields)


def data(local, fields, values):
    return bytes([local])+b"".join(struct.pack("<"+fmt,value) for fmt,value in zip(fields,values))


def sample_fit():
    # 2025-06-01 is a synthetic UTC date, no real runner identifiers.
    start=int((datetime(2025,6,1,12,tzinfo=timezone.utc)-FIT_EPOCH).total_seconds())
    # Record fields: timestamp, distance, HR, cadence (FIT single-foot cycles),
    # power, altitude. FIT scale: distance /100 m, altitude /5 - 500 m.
    rec=[(253,4,0x86),(5,4,0x86),(3,1,0x02),(4,1,0x02),(7,2,0x84),(2,2,0x84)]
    lap=[(9,4,0x86),(8,4,0x86)]
    sess=[(2,4,0x86),(7,4,0x86),(8,4,0x86),(9,4,0x86),
          (5,1,0x00),(16,1,0x02),(17,1,0x02),(18,1,0x02),
          (20,2,0x84),(22,2,0x84),(23,2,0x84)]
    body=definition(0,20,rec)+definition(1,19,lap)+definition(2,18,sess)
    body+=data(0,["I","I","B","B","H","H"],[start,0,255,80,190,3000])
    body+=data(0,["I","I","B","B","H","H"],[start+300,100000,150,82,250,3010])
    body+=data(0,["I","I","B","B","H","H"],[start+720,200000,160,85,270,3020])
    body+=data(1,["I","I"],[100000,300000])
    body+=data(1,["I","I"],[100000,300000])
    # FIT sport enum 'running'=1; elapsed 720s vs timer 600s.
    body+=data(2,["I","I","I","I","B","B","B","B","H","H","H"],
               [start,720000,600000,200000,1,155,171,82,255,15,10])
    header=struct.pack("<BBHI4sH",14,0x20,2100,len(body),b".FIT",0)
    return header+body+b"\x00\x00"


def test_real_decoder_accepts_binary_fit_with_pauses_and_laps():
    decoded=parse_activity("synthetic.fit",sample_fit())
    assert decoded["distanceMiles"]>1.2
    assert decoded["durationSeconds"]==600
    assert decoded["elapsedSeconds"]==720
    assert decoded["avgHeartRate"]==155
    assert decoded["maxHeartRate"]==171
    assert decoded["avgCadenceSpm"]==164
    assert decoded["avgPowerWatts"]==255
    assert decoded["elevationGainMeters"]==15
    assert decoded["elevationLossMeters"]==10
    assert len(decoded["laps"])==2
    assert decoded["laps"][0]["source"]=="device_lap"
    assert decoded["track"][0]["heartRate"] is None
    assert decoded["track"][0]["cadenceSpm"]==160
    assert decoded["track"][0]["powerWatts"]==190
    assert decoded["track"][-1]["elapsed"]==720

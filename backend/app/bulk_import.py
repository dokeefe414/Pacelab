"""Bulk COROS export ZIP ingest without filesystem extraction or credential sync."""
from io import BytesIO
from pathlib import PurePosixPath
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .activity_import import ActivityParseError, MAX_FILE_BYTES, parse_activity
from .db import get_db
from .dependencies import current_user
from .import_service import persist_activity
from .models import User

router=APIRouter(prefix="/api/activities",tags=["activities"])

MAX_ZIP_BYTES=25*1024*1024
MAX_ZIP_UNCOMPRESSED=80*1024*1024
MAX_ZIP_FILES=100
SUPPORTED={".fit",".gpx",".tcx"}


def validate_members(zf:ZipFile):
    members=[]
    total=0
    infos=zf.infolist()
    if len(infos)>MAX_ZIP_FILES*2:
        raise ActivityParseError("ZIP contains too many entries (limit: 200, including directories)")
    for info in infos:
        if info.is_dir() or info.filename.startswith("__MACOSX/"):
            continue
        # Never unpack paths, symlinks or hidden files. Read only the stream.
        basename=PurePosixPath(info.filename.replace("\\","/")).name
        if not basename or basename.startswith("."):
            continue
        suffix=PurePosixPath(basename).suffix.lower()
        if suffix not in SUPPORTED:
            continue
        if info.flag_bits&1:
            raise ActivityParseError("Encrypted ZIP entries are not supported")
        if info.file_size>MAX_FILE_BYTES:
            raise ActivityParseError("A ZIP activity exceeds the 10 MB per-file limit")
        total+=info.file_size
        if total>MAX_ZIP_UNCOMPRESSED:
            raise ActivityParseError("ZIP would expand beyond the 80 MB total limit")
        members.append((info,basename))
        if len(members)>MAX_ZIP_FILES:
            raise ActivityParseError("ZIP contains over 100 supported activity files")
    if not members:
        raise ActivityParseError("No FIT, GPX or TCX activity files found in ZIP")
    return members


@router.post("/import-bulk")
async def import_bulk(file:UploadFile=File(...),user:User=Depends(current_user),db:Session=Depends(get_db)):
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(422,"Select a .zip export")
    try:
        buffer=await file.read(MAX_ZIP_BYTES+1)
    finally:
        await file.close()
    if len(buffer)>MAX_ZIP_BYTES or not buffer:
        raise HTTPException(413,"ZIP must be nonempty and under 25 MB")
    try:
        with ZipFile(BytesIO(buffer)) as zip_file:
            members=validate_members(zip_file)
            summary={"imported":0,"duplicates":0,"failed":0,"files":[]}
            for info,filename in members:
                try:
                    with zip_file.open(info) as part:
                        content=part.read(MAX_FILE_BYTES+1)
                    if len(content)>MAX_FILE_BYTES:
                        raise ActivityParseError("Activity exceeds 10 MB")
                    data=parse_activity(filename,content)
                    result=persist_activity(data,user,db)
                    summary["imported" if result["imported"] else "duplicates"]+=1
                    summary["files"].append({"name":filename,"status":"imported" if result["imported"] else "duplicate"})
                except (ActivityParseError,BadZipFile,RuntimeError,ValueError) as exc:
                    summary["failed"]+=1
                    summary["files"].append({"name":filename,"status":"failed","message":str(exc)[:180]})
            return summary
    except (BadZipFile,ActivityParseError,RuntimeError,ValueError) as exc:
        raise HTTPException(422,"Unreadable ZIP export: "+str(exc)[:180]) from exc

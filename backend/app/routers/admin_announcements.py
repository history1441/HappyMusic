from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.announcement import Announcement
from app.schemas.admin import AnnouncementCreate, AnnouncementUpdate
from app.utils.auth import get_admin_user

router = APIRouter(prefix="/api/admin", tags=["公告管理"])


@router.get("/announcements")
def list_announcements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    total = db.query(Announcement).count()
    items = db.query(Announcement).order_by(
        Announcement.is_pinned.desc(), Announcement.created_at.desc(),
    ).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [{
            "id": a.id, "title": a.title, "content": a.content,
            "type": a.type, "is_pinned": a.is_pinned,
            "created_by": a.created_by,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        } for a in items],
    }


@router.post("/announcements")
def create_announcement(
    req: AnnouncementCreate, admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db),
):
    a = Announcement(
        title=req.title, content=req.content,
        type=req.type, is_pinned=req.is_pinned, created_by=admin_id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"id": a.id, "ok": True}


@router.put("/announcements/{announcement_id}")
def update_announcement(
    announcement_id: int, req: AnnouncementUpdate,
    admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db),
):
    a = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="公告不存在")
    if req.title is not None:
        a.title = req.title
    if req.content is not None:
        a.content = req.content
    if req.type is not None:
        a.type = req.type
    if req.is_pinned is not None:
        a.is_pinned = req.is_pinned
    db.commit()
    return {"ok": True}


@router.delete("/announcements/{announcement_id}")
def delete_announcement(
    announcement_id: int, admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db),
):
    a = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="公告不存在")
    db.delete(a)
    db.commit()
    return {"ok": True}


@router.put("/announcements/{announcement_id}/pin")
def toggle_pin(
    announcement_id: int, pinned: bool = True,
    admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db),
):
    a = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="公告不存在")
    a.is_pinned = pinned
    db.commit()
    return {"ok": True}

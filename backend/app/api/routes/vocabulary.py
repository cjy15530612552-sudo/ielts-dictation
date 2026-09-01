from fastapi import APIRouter, HTTPException, Query, Request, Response, status

from app.models.practice import FavoriteCreateResponse, FavoriteWordCreate


router = APIRouter(prefix="/api/vocabulary", tags=["vocabulary"])


@router.get("")
async def list_vocabulary(
    request: Request,
    limit: int | None = Query(default=None, ge=1, le=100),
    practice_id: str | None = Query(default=None),
    unassigned: bool = Query(default=False),
):
    if practice_id and unassigned:
        raise HTTPException(400, "Choose practice_id or unassigned, not both")
    return await request.app.state.database.list_favorites(limit, practice_id, unassigned)


@router.get("/groups")
async def list_vocabulary_groups(request: Request):
    return await request.app.state.database.list_favorite_groups()


@router.post("", response_model=FavoriteCreateResponse, status_code=status.HTTP_201_CREATED)
async def add_favorite(payload: FavoriteWordCreate, request: Request):
    if payload.practice_id and not await request.app.state.database.get_practice(payload.practice_id):
        raise HTTPException(400, "Source practice not found")
    item, created = await request.app.state.database.add_favorite(payload.model_dump())
    return {"item": item, "created": created}


@router.get("/{favorite_id}")
async def get_favorite(favorite_id: str, request: Request):
    item = await request.app.state.database.get_favorite(favorite_id)
    if not item:
        raise HTTPException(404, "Favorite word not found")
    return item


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_favorite(favorite_id: str, request: Request):
    if not await request.app.state.database.delete_favorite(favorite_id):
        raise HTTPException(404, "Favorite word not found")
    return Response(status_code=204)

"""announcement publish_at

Revision ID: a9f3c2e1b7d4
Revises: 514b74ad274f
Create Date: 2026-06-27 10:00:00.000000

为 announcements 表新增 publish_at(可空 DateTime),支持公告定时发布。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a9f3c2e1b7d4'
down_revision: Union[str, None] = '514b74ad274f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('announcements', sa.Column('publish_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('announcements', 'publish_at')

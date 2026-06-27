"""build_record abi

Revision ID: c7b1e4f9a2c3
Revises: a9f3c2e1b7d4
Create Date: 2026-06-27 11:00:00.000000

为 build_records 表新增 abi 列,支持按设备 CPU 架构下发对应安装包。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7b1e4f9a2c3'
down_revision: Union[str, None] = 'a9f3c2e1b7d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('build_records', sa.Column('abi', sa.String(length=20), nullable=True, server_default=''))


def downgrade() -> None:
    op.drop_column('build_records', 'abi')

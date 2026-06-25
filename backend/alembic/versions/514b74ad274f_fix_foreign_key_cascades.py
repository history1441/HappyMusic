"""fix foreign key cascades

Revision ID: 514b74ad274f
Revises: 23c06cd1d28b
Create Date: 2026-06-25 12:54:53.961603

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '514b74ad274f'
down_revision: Union[str, None] = '23c06cd1d28b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. play_logs: 清理孤儿数据(指向已删用户的记录,加外键前必须清理)
    bind.execute(sa.text(
        "UPDATE play_logs SET user_id = NULL "
        "WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)"
    ))

    # 2. play_logs: user_id 改为 nullable(支持 SET NULL 级联)
    op.alter_column(
        'play_logs', 'user_id',
        existing_type=sa.Integer(),
        nullable=True,
        existing_server_default=None,
    )

    # 3. play_logs: 添加外键(SET NULL — 用户删除时,统计记录匿名化保留)
    op.create_foreign_key(
        'fk_playlog_user', 'play_logs', 'users',
        ['user_id'], ['id'], ondelete='SET NULL',
    )

    # 4. game_scores: 修改外键为 CASCADE(分数随用户删除,无历史价值)
    # MySQL 需要先 DROP 旧外键(名字由 MySQL 自动生成,查询 information_schema 获取)
    result = bind.execute(sa.text(
        "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE "
        "WHERE TABLE_SCHEMA = DATABASE() "
        "AND TABLE_NAME = 'game_scores' AND COLUMN_NAME = 'user_id' "
        "AND REFERENCED_TABLE_NAME = 'users'"
    ))
    existing_fk = result.scalar()
    if existing_fk:
        op.drop_constraint(existing_fk, 'game_scores', type_='foreignkey')

    op.create_foreign_key(
        'fk_gamescore_user', 'game_scores', 'users',
        ['user_id'], ['id'], ondelete='CASCADE',
    )


def downgrade() -> None:
    # 回滚:play_logs 移除外键 + user_id 恢复 NOT NULL
    op.drop_constraint('fk_playlog_user', 'play_logs', type_='foreignkey')
    # 注意:回滚时 NOT NULL 可能因有 NULL 值而失败,需先清理
    op.execute(sa.text(
        "UPDATE play_logs SET user_id = 0 WHERE user_id IS NULL"
    ))
    op.alter_column(
        'play_logs', 'user_id',
        existing_type=sa.Integer(),
        nullable=False,
        existing_server_default=None,
    )

    # game_scores: 恢复默认外键(无 ondelete,即 RESTRICT)
    op.drop_constraint('fk_gamescore_user', 'game_scores', type_='foreignkey')
    op.create_foreign_key(
        'game_scores_ibfk_1', 'game_scores', 'users',
        ['user_id'], ['id'],
    )

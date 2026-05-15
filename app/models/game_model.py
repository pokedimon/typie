from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.db_connection import database


class Game(database.Model):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(primary_key=True)
    chars: Mapped[str] = mapped_column(nullable=False)
    velocity: Mapped[str] = mapped_column(nullable=False)
    time: Mapped[int] = mapped_column(nullable=False)
    score: Mapped[int] = mapped_column(nullable=False)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="games")

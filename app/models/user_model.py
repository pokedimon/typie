from flask_login import UserMixin
from sqlalchemy import LargeBinary
from sqlalchemy.orm import Mapped, mapped_column, relationship
from werkzeug.security import check_password_hash, generate_password_hash

from app.db.db_connection import database


class User(database.Model, UserMixin):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column(unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(nullable=False)
    first_name: Mapped[str] = mapped_column(nullable=False)
    last_name: Mapped[str] = mapped_column(nullable=False)
    in_school: Mapped[bool] = mapped_column(nullable=False, default=False)
    grade: Mapped[int] = mapped_column(nullable=False, default=0)
    avatar: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    level: Mapped[int] = mapped_column(nullable=False, default=0)
    total_score: Mapped[int] = mapped_column(nullable=False, default=0)

    games = relationship("Game", back_populates="user")

    def set_password(self, password):
        self.hashed_password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.hashed_password, password)

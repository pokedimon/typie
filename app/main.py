import os
import sys

# ---------------------------------------------------------------------------
# Path Configuration:
# Ensure the root of the project is included in sys.path so that absolute
# imports like `from app.db.db_connection import ...` work regardless of
# the current working directory or execution context (e.g. running python directly).
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import json
from flask import Flask, render_template, url_for, request, redirect, jsonify, session, current_app
from flask_login import LoginManager, login_user, logout_user, current_user, login_required
import secrets
import base64
from app.db.db_connection import database
from app.models.user_model import User
from app.models.game_model import Game

# ---------------------------------------------------------------------------
# Flask Application Setup & Configuration:
# - BASE_DIR points to the /app directory.
# - instance_path is set to BASE_DIR so instance files resolve relative to /app.
# - SECRET_KEY is generated using secrets.token_urlsafe(32) for secure session cookies.
# - SQLALCHEMY_DATABASE_URI uses environment variable or defaults to SQLite in app/db/typie.db.
# - SQLALCHEMY_ECHO outputs all executed SQL statements to the console for debugging.
# ---------------------------------------------------------------------------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app = Flask(__name__, instance_path=BASE_DIR)
app.config["SECRET_KEY"] = secrets.token_urlsafe(32)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "SQLALCHEMY_DATABASE_URI",
    f"sqlite:///{os.path.join(BASE_DIR, 'db', 'typie.db')}"
)
app.config['SQLALCHEMY_ECHO'] = True

# ---------------------------------------------------------------------------
# Authentication & Database Initialization:
# - LoginManager handles session-based user authentication.
# - database.init_app(app) binds the SQLAlchemy instance to this Flask app.
# - database.create_all() inside an application context creates all tables if they don't exist yet.
# ---------------------------------------------------------------------------
login_manager = LoginManager()
login_manager.init_app(app)

database.init_app(app)
with app.app_context():
    database.create_all()


# ---------------------------------------------------------------------------
# Flask-Login User Loader:
# Flask-Login calls this callback with the user ID stored in the session cookie
# on every request to retrieve and populate `current_user`.
# ---------------------------------------------------------------------------
@login_manager.user_loader
def load_user(user_id):
    return database.session.get(User, user_id)


# ---------------------------------------------------------------------------
# Levels Dataset Loader:
# Reads levels line-by-line from a JSON Lines (.jsonl) file in static/json/levels.jsonl.
# Each line represents a distinct level containing text, difficulty, and metadata.
# Gracefully falls back to an empty list if the file is missing.
# ---------------------------------------------------------------------------
def _load_levels():
    loaded = []
    file_path = os.path.join(current_app.static_folder, "json", "levels.jsonl")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    loaded.append(json.loads(line))
    except FileNotFoundError:
        loaded = []
    return loaded


# Load all levels into memory once at application startup
with app.app_context():
    LEVELS = _load_levels()


# ---------------------------------------------------------------------------
# Unauthorized Handler:
# Redirects unauthenticated users trying to access routes protected by
# @login_required to the index page with the '#login' hash to automatically
# trigger the login modal in the UI.
# ---------------------------------------------------------------------------
@login_manager.unauthorized_handler
def unauthorized_callback():
    return redirect(url_for('index') + '#login')


# ---------------------------------------------------------------------------
# Main / Landing Page:
# Serves the home page template (index.html). Supports an optional 'message'
# parameter for flash/status notices.
# ---------------------------------------------------------------------------
@app.route("/", methods=["GET", "POST"])
@app.route("/index", methods=["GET", "POST"])
@app.route("/index?message=<string:message>")
def index(message=[]):
    return render_template("index.html", message=message)


# ---------------------------------------------------------------------------
# Sandbox Mode:
# Free-typing practice playground. Requires the user to be logged in.
# ---------------------------------------------------------------------------
@app.route("/sandbox")
@login_required
def sandbox():
    return render_template("game.html")


# ---------------------------------------------------------------------------
# Levels List Page:
# Displays available levels and tracks current user progress.
# Progress is read from current_user.level for logged-in users,
# or from session['level'] for anonymous/guest users.
# ---------------------------------------------------------------------------
@app.route("/levels")
def levels():
    user_level = current_user.level if current_user.is_authenticated else session.get('level', 0)
    return render_template("levels.html", levels=LEVELS, current_level=user_level)


# ---------------------------------------------------------------------------
# Level Play Route:
# Serves a specific level for playing.
# Enforces linear progression: users cannot skip ahead beyond (current_level + 1).
# If the level doesn't exist or is locked, redirects back to the /levels map.
# ---------------------------------------------------------------------------
@app.route("/level/<int:level_id>")
def play_level(level_id):
    user_level = current_user.level if current_user.is_authenticated else session.get('level', 0)
    if level_id > user_level + 1:
        return redirect(url_for('levels'))
    lvl = next((l for l in LEVELS if l["id"] == level_id), None)
    if not lvl:
        return redirect(url_for('levels'))
    return render_template("level_play.html", level=lvl)


# ---------------------------------------------------------------------------
# Update Level Progress (API):
# Receives JSON payload `{"level": <id>}` when a user completes a level.
# If the completed level is higher than their current recorded progress:
# - Logged-in users: updates and commits `current_user.level` to the database.
# - Guest users: stores the new level in their Flask `session`.
# Returns a JSON confirmation with the highest level reached.
# ---------------------------------------------------------------------------
@app.route("/update_level", methods=["POST"])
def update_level():
    data = json.loads(request.data)
    completed_level_id = data.get("level")
    user_level = current_user.level if current_user.is_authenticated else session.get('level', 0)

    if completed_level_id > user_level:
        if current_user.is_authenticated:
            current_user.level = completed_level_id
            database.session.commit()
        else:
            session['level'] = completed_level_id

    return jsonify({"status": "ok", "level": max(completed_level_id, user_level)})


# ---------------------------------------------------------------------------
# Leaderboard Page:
# Renders the leaderboard HTML skeleton. The actual leaderboard data is
# populated client-side via fetch calls to `/api/leaderboard` and `/api/games`.
# ---------------------------------------------------------------------------
@app.route("/leaderboard", methods=["GET", "POST"])
def leaderboard():
    return render_template("leaderboard.html")


# ---------------------------------------------------------------------------
# User Profile View:
# Displays user info and stats for a given user ID.
# Fetches the user from the database, converts binary avatar bytes into a
# base64 UTF-8 string for inline HTML rendering, or redirects to index if not found.
# ---------------------------------------------------------------------------
@app.route("/profile/<int:user_id>")
def profile(user_id):
    user = database.session.get(User, user_id)
    if not user:
        return redirect(url_for('index'))
    avatar_b64 = base64.b64encode(user.avatar).decode('utf-8') if user.avatar else ""
    return render_template("profile.html", user=user, avatar_b64=avatar_b64)


# ---------------------------------------------------------------------------
# Edit Profile (API):
# Allows logged-in users to update their first name, last name, and avatar.
# Base64 avatar strings (e.g. data URLs from client-side file uploaders) are
# stripped of their header prefix, decoded into raw bytes, and saved to the database.
# ---------------------------------------------------------------------------
@app.route("/edit_profile", methods=["POST"])
@login_required
def edit_profile():
    data = json.loads(request.data)
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    avatar_b64 = data.get("avatar_b64")

    if first_name:
        current_user.first_name = first_name
    if last_name:
        current_user.last_name = last_name
    if avatar_b64:
        if "," in avatar_b64:
            avatar_b64 = avatar_b64.split(",")[1]
        try:
            current_user.avatar = base64.b64decode(avatar_b64)
        except Exception:
            pass

    database.session.commit()
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# User Registration / Creation (API):
# Receives JSON with login credentials and profile metadata.
# 1. Checks if the username/login is already taken.
# 2. Reads the default avatar image from static/img/default_pfp.png as bytes.
# 3. Creates the new User model instance and hashes the password securely.
# 4. Commits the record to the database and returns a redirect response to index.
# ---------------------------------------------------------------------------
@app.route("/createuser", methods=["POST"])
def create_user():
    user_data = json.loads(request.data)
    if not user_data.get('message'):
        if not database.session.query(User).filter(User.login == user_data["login"]).first():
            default_pfp_path = os.path.join(BASE_DIR, 'static', 'img', 'default_pfp.png')
            with open(default_pfp_path, 'rb') as f:
                pfp_bytes = f.read()
            user = User(
                login=user_data["login"],
                first_name=user_data["first_name"],
                last_name=user_data["last_name"],
                in_school=user_data["in_school"],
                grade=user_data["grade"],
                avatar=pfp_bytes
            )
            user.set_password(user_data["password"])
            database.session.add(user)
            database.session.commit()
            return jsonify({"redirect": url_for('index')})
        else:
            user_data.setdefault('message', []).append('Логин уже занят')
            return jsonify({"messages": user_data['message']})
    return jsonify({"messages": user_data.get('message', [])})


# ---------------------------------------------------------------------------
# User Authentication / Login (API):
# Receives JSON payload with `login` and `password`.
# Queries the database for the user by login, verifies the password hash,
# logs the user into the session via `login_user`, and returns a redirect URL.
# If verification fails, returns an error message.
# ---------------------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login():
    user_data = json.loads(request.data)
    user = database.session.query(User).filter(User.login == user_data['login']).first()
    if user and user.check_password(user_data['password']):
        login_user(user, remember=True)
        return jsonify({"redirect": url_for('index')})
    return jsonify({"messages": ['Неверный логин или пароль']})


# ---------------------------------------------------------------------------
# User Logout:
# Clears the user session using Flask-Login's logout_user() and redirects to index.
# ---------------------------------------------------------------------------
@app.route("/logout")
def logout():
    logout_user()
    return redirect("/index")


# ---------------------------------------------------------------------------
# Leaderboard Data by Users (API):
# Returns a ranked JSON list of all users sorted by total_score descending.
# Includes formatted name, grade, score, rank, and base64-encoded avatar string.
# ---------------------------------------------------------------------------
@app.route("/api/leaderboard", methods=["GET"])
def api_leaderboard():
    users = database.session.query(User).order_by(User.total_score.desc()).all()
    result = []
    for idx, u in enumerate(users):
        result.append({
            "id": u.id,
            "name": f"{u.first_name} {u.last_name}",
            "grade": str(u.grade),
            "score": u.total_score,
            "rank": idx + 1,
            "avatar_b64": u.avatar_b64
        })
    return jsonify(result)


# ---------------------------------------------------------------------------
# Leaderboard Data by Games / Typing Runs (API):
# Returns a ranked JSON list of individual game sessions sorted by score descending.
# Includes characters count, typing velocity/WPM, duration, score, and player details.
# ---------------------------------------------------------------------------
@app.route("/api/games", methods=["GET"])
def api_games():
    games = database.session.query(Game).order_by(Game.score.desc()).all()
    result = []
    for idx, g in enumerate(games):
        result.append({
            "user_id": g.user.id,
            "name": f"{g.user.first_name} {g.user.last_name}",
            "grade": str(g.user.grade),
            "avatar_b64": g.user.avatar_b64,
            "chars_len": len(g.chars) if g.chars else 0,
            "velocity": str(g.velocity),
            "time": g.time,
            "score": g.score,
            "rank": idx + 1
        })
    return jsonify(result)


# ---------------------------------------------------------------------------
# Get Score (API):
# Returns the total cumulative score for the currently logged-in user.
# ---------------------------------------------------------------------------
@app.route("/get_score", methods=["GET"])
@login_required
def get_score():
    return jsonify({"total_score": current_user.total_score})


# ---------------------------------------------------------------------------
# Update Total Score (API):
# Receives a new score in JSON `{"score": <number>}`.
# Updates `current_user.total_score` in the database and commits the transaction.
# ---------------------------------------------------------------------------
@app.route("/update_score", methods=["POST"])
@login_required
def update_score():
    data = json.loads(request.data)
    new_score = data.get("score")
    if new_score is None:
        return jsonify({"status": "error", "message": "Missing score"}), 400
    current_user.total_score = new_score
    database.session.commit()
    return jsonify({"status": "ok", "total_score": current_user.total_score})


# ---------------------------------------------------------------------------
# Record Completed Game Session (API):
# Receives performance telemetry for a single typing session (chars typed,
# velocity, time elapsed, score), instantiates a Game model attached to
# current_user.id, and commits it to the database.
# ---------------------------------------------------------------------------
@app.route("/creategame", methods=["POST"])
@login_required
def create_game():
    game_data = json.loads(request.data)
    game = Game(
        chars=game_data.get("chars", ""),
        velocity=game_data.get("velocity", ""),
        time=game_data.get("time", 0),
        score=game_data.get("score", 0),
        user_id=current_user.id,
    )
    database.session.add(game)
    database.session.commit()
    return jsonify({"status": "ok", "game_id": game.id})


# ---------------------------------------------------------------------------
# Server Entry Point:
# Runs the Flask application using environment variables:
# - FLASK_RUN_HOST: host IP (defaults to 0.0.0.0 for container/network access)
# - FLASK_RUN_PORT: port number (defaults to 8081)
# - FLASK_DEBUG: debug mode flag (defaults to True)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    host = os.environ.get("FLASK_RUN_HOST", "0.0.0.0")
    port = int(os.environ.get("FLASK_RUN_PORT", 8081))
    debug = os.environ.get("FLASK_DEBUG", "True").lower() in ("true", "1")
    app.run(host=host, port=port, debug=debug)

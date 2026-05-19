import os
import json
from flask import Flask, render_template, url_for, request, redirect, jsonify
from flask_login import LoginManager, login_user, logout_user, current_user, login_required
import secrets
import base64
from app.db.db_connection import database
from app.models.user_model import User
from app.models.game_model import Game

app = Flask(__name__, instance_path=os.getcwd())
app.config["SECRET_KEY"] = secrets.token_urlsafe(32)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///db/typie.db"
app.config['SQLALCHEMY_ECHO'] = True

login_manager = LoginManager()
login_manager.init_app(app)

database.init_app(app)
with app.app_context():
    database.create_all()


@login_manager.user_loader
def load_user(user_id):
    return database.session.get(User, user_id)


@app.route("/", methods=["GET", "POST"])
@app.route("/index", methods=["GET", "POST"])
@app.route("/index?message=<string:message>")
def index(message=[]):
    return render_template("index.html", message=message)


@app.route("/sandbox")
@login_required
def sandbox():
    return render_template("game.html")


@app.route("/leaderboard", methods=["GET", "POST"])
def leaderboard():
    return render_template("leaderboard.html")


@app.route("/profile/<int:user_id>")
def profile(user_id):
    user = database.session.get(User, user_id)
    if not user:
        return redirect(url_for('index'))
    avatar_b64 = base64.b64encode(user.avatar).decode('utf-8') if user.avatar else ""
    return render_template("profile.html", user=user, avatar_b64=avatar_b64)


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


@app.route("/createuser", methods=["POST"])
def create_user():
    user_data = json.loads(request.data)
    if not user_data.get('message'):
        if not database.session.query(User).filter(User.login == user_data["login"]).first():
            with open('static/img/default_pfp.png', 'rb') as f:
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


@app.route("/login", methods=["POST"])
def login():
    user_data = json.loads(request.data)
    user = database.session.query(User).filter(User.login == user_data['login']).first()
    if user and user.check_password(user_data['password']):
        login_user(user, remember=True)
        return jsonify({"redirect": url_for('index')})
    return jsonify({"messages": ['Неверный логин или пароль']})


@app.route("/logout")
def logout():
    logout_user()
    return redirect("/index")


@app.route("/api/leaderboard", methods=["GET"])
def api_leaderboard():
    users = database.session.query(User).order_by(User.total_score.desc()).all()
    result = []
    for u in users:
        result.append({
            "id": u.id,
            "name": f"{u.first_name} {u.last_name}",
            "grade": str(u.grade),
            "score": u.total_score,
            "rank": 0,
            "avatar_b64": u.avatar_b64
        })
    return jsonify(result)


@app.route("/api/games", methods=["GET"])
def api_games():
    games = database.session.query(Game).order_by(Game.score.desc()).all()
    result = []
    for g in games:
        result.append({
            "user_id": g.user.id,
            "name": f"{g.user.first_name} {g.user.last_name}",
            "grade": str(g.user.grade),
            "avatar_b64": g.user.avatar_b64,
            "chars_len": len(g.chars) if g.chars else 0,
            "velocity": str(g.velocity),
            "time": g.time,
            "score": g.score,
            "rank": 0
        })
    return jsonify(result)


@app.route("/get_score", methods=["GET"])
@login_required
def get_score():
    return jsonify({"total_score": current_user.total_score})


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


if __name__ == "__main__":
    app.run(port=8081, debug=True)

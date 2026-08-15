from __future__ import annotations

import os
import sys
from io import BytesIO
from pathlib import Path

from flask import Flask, flash, redirect, render_template, request, send_file, url_for

from cli import parse_exterieur_from_text, parse_interieur_from_text
from horses import Horse, HorseDatabase


SEX_OPTIONS = ["Stallion", "Mare"]


def resolve_data_path() -> Path:
    override = os.getenv("MDR_BREEDING_DATA_PATH")
    if override:
        return Path(override).expanduser()

    if getattr(sys, "frozen", False):
        appdata = os.getenv("APPDATA") or os.getenv("LOCALAPPDATA")
        if appdata:
            base_dir = Path(appdata) / "MDRBreeding"
        else:
            base_dir = Path.home() / ".mdr-breeding"
    else:
        base_dir = Path(__file__).resolve().parent

    return base_dir / "horses.csv"


def resource_path(relative_path: str) -> Path:
    if getattr(sys, "frozen", False):
        base_dir = Path(getattr(sys, "_MEIPASS"))
    else:
        base_dir = Path(__file__).resolve().parent
    return base_dir / relative_path


def build_exterieur_text(horse: Horse | None) -> str:
    if not horse:
        return ""
    return "\n".join(f"{part}\t{horse.exterieur.get(part, '')}" for part in Horse.BODY_PARTS)


def build_interieur_text(horse: Horse | None) -> str:
    if not horse:
        return ""
    return "\n".join(f"{category}\t{horse.interieur.get(category, '')}" for category in Horse.INTERIEUR_CATEGORIES)


def create_app(data_path: str | Path | None = None) -> Flask:
    app = Flask(
        __name__,
        template_folder=str(resource_path("templates")),
        static_folder=str(resource_path("static")),
    )
    app.secret_key = "dev-secret"

    db = HorseDatabase(str(data_path) if data_path is not None else None)

    def parse_horse_form(existing_name: str | None = None) -> Horse:
        name = request.form.get("name", "").strip()
        sex = request.form.get("sex", "").strip()
        race = request.form.get("race", "").strip()
        color = request.form.get("color", "/").strip() or "/"

        diseases = {disease: request.form.get(f"disease_{disease}") == "on" for disease in Horse.DISEASES}
        exterieur = parse_exterieur_from_text(request.form.get("exterieur", ""))
        interieur = parse_interieur_from_text(request.form.get("interieur", ""))

        horse = Horse(
            name=name,
            sex=sex,
            race=race,
            color=color,
            diseases=diseases,
            exterieur=exterieur,
            interieur=interieur,
        )

        if existing_name and existing_name != name and name in db.horses:
            raise ValueError(f"Horse '{name}' already exists.")

        return horse

    @app.route("/")
    def index():
        horses = db.list_horses()
        return render_template("index.html", horses=horses, csv_name=db.csv_path.name if db.csv_path else "horses.csv")

    @app.route("/import", methods=["POST"])
    def import_csv():
        uploaded_file = request.files.get("csv_file")
        if not uploaded_file or uploaded_file.filename == "":
            flash("Please choose a CSV file to upload.")
            return redirect(url_for("index"))

        try:
            csv_text = uploaded_file.read().decode("utf-8-sig")
            db.replace_from_csv_text(csv_text)
            flash("CSV uploaded successfully.")
        except Exception as e:
            flash(f"Error importing CSV: {e}")

        return redirect(url_for("index"))

    @app.route("/export")
    def export_csv():
        csv_text = db.export_csv_text()
        buffer = BytesIO(csv_text.encode("utf-8"))
        buffer.seek(0)
        return send_file(
            buffer,
            mimetype="text/csv",
            as_attachment=True,
            download_name="horses.csv",
        )

    @app.route("/add", methods=["GET", "POST"])
    def add():
        if request.method == "POST":
            try:
                horse = parse_horse_form()
                db.add_horse(horse)
                flash(f"Horse '{horse.name}' added.")
                return redirect(url_for("index"))
            except Exception as e:
                flash(f"Error: {e}")

        return render_template(
            "horse_form.html",
            title="Add Horse",
            submit_label="Add",
            horse=None,
            sex_options=SEX_OPTIONS,
            diseases=sorted(Horse.DISEASES),
            exterieur_text="",
            interieur_text="",
            action_url=url_for("add"),
        )

    @app.route("/edit/<name>", methods=["GET", "POST"])
    def edit(name):
        horse = db.get_horse(name)
        if not horse:
            flash("Horse not found")
            return redirect(url_for("index"))

        if request.method == "POST":
            try:
                updated = parse_horse_form(existing_name=name)
                db.add_horse(updated)
                if updated.name != name:
                    db.delete_horse(name)
                flash(f"Horse '{updated.name}' updated.")
                return redirect(url_for("view", name=updated.name))
            except Exception as e:
                flash(f"Error: {e}")

        return render_template(
            "horse_form.html",
            title=f"Edit Horse: {horse.name}",
            submit_label="Save",
            horse=horse,
            sex_options=SEX_OPTIONS,
            diseases=sorted(Horse.DISEASES),
            exterieur_text=build_exterieur_text(horse),
            interieur_text=build_interieur_text(horse),
            action_url=url_for("edit", name=horse.name),
        )

    @app.route("/view/<name>")
    def view(name):
        horse = db.get_horse(name)
        if not horse:
            flash("Horse not found")
            return redirect(url_for("index"))
        return render_template("view.html", horse=horse)

    @app.route("/delete/<name>")
    def delete(name):
        db.delete_horse(name)
        flash(f"Deleted {name}")
        return redirect(url_for("index"))

    @app.route("/bestmates/<name>")
    def bestmates(name):
        subject = db.get_horse(name)
        if not subject:
            flash("Horse not found")
            return redirect(url_for("index"))

        # always show all partners; compute filtering statistics
        all_others = [h for h in db.list_horses() if h.name != name]
        excluded_sex = [h for h in all_others if h.sex.strip().lower() == subject.sex.strip().lower()]
        remaining_after_sex = [h for h in all_others if h.sex.strip().lower() != subject.sex.strip().lower()]
        excluded_race = [h for h in remaining_after_sex if h.race.strip().lower() != subject.race.strip().lower()]
        remaining_after_race = [h for h in remaining_after_sex if h.race.strip().lower() == subject.race.strip().lower()]
        excluded_disease = [h for h in remaining_after_race if subject.get_diseases() & h.get_diseases()]
        remaining_valid = [h for h in remaining_after_race if not (subject.get_diseases() & h.get_diseases())]

        # always show all possible partners (ordered)
        partners = db.get_best_mates(name, top_n=None)

        stats = {
            "total_others": len(all_others),
            "excluded_sex": len(excluded_sex),
            "excluded_race": len(excluded_race),
            "excluded_disease": len(excluded_disease),
            "remaining_valid": len(remaining_valid),
        }

        return render_template("bestmates.html", subject=subject, partners=partners, stats=stats)

    app.db = db  # type: ignore[attr-defined]
    app.data_path = Path(db.csv_path) if db.csv_path is not None else None  # type: ignore[attr-defined]
    return app


app = create_app()


def main() -> None:
    app.run(debug=True)


if __name__ == "__main__":
    main()

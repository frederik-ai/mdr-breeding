import json
from io import StringIO
from pathlib import Path
from typing import Dict, List, Set

import pandas as pd


class Horse:
    """Represents a horse with genetic and disease attributes."""
    
    # Disease types
    DISEASES = {"CA", "HERDA", "PSSM", "EMH", "ASD", "HYPP", "LFS", "SCID", "GBED", "JEB"}
    
    # Exterieur body parts
    BODY_PARTS = [
        "Kopf", "Gebiss", "Hals", "Halsansatz", "Widerrist", "Schulter",
        "Brust", "Rückenlinie", "Rückenlänge", "Kruppe", "Beinwinkelung",
        "Beinstellung", "Fesseln", "Hufe"
    ]
    
    # Interieur categories
    INTERIEUR_CATEGORIES = [
        "Temperament", "Gelehrigkeit", "Leistungsbereitschaft",
        "Aufmerksamkeit", "Gutmütigkeit", "Nervenstärke",
        "Intelligenz", "Siegeswille", "Furchtlosigkeit", "Sozialverhalten"
    ]
    
    def __init__(self,
        name: str,
        sex: str,
        race: str,
        color: str,
        diseases: Dict[str, bool],
        exterieur: Dict[str, str],
        interieur: Dict[str, str],
        tournament_ratings: Dict[str, float] = None
    ):
        self.name = name
        self.sex = sex
        self.race = race
        self.color = color
        self.diseases = diseases
        self.exterieur = exterieur
        self.interieur = interieur
        self.tournament_ratings = tournament_ratings or {}
        
        self._validate_data()
    
    def _validate_data(self):
        """Validate that all required diseases and body parts are present."""
        # Check diseases
        for disease in self.DISEASES:
            if disease not in self.diseases:
                raise ValueError(f"Missing disease: {disease}")
        
        # Check body parts
        for body_part in self.BODY_PARTS:
            if body_part not in self.exterieur:
                raise ValueError(f"Missing body part: {body_part}")
        
        # Check interieur categories
        for category in self.INTERIEUR_CATEGORIES:
            if category not in self.interieur:
                raise ValueError(f"Missing interieur category: {category}")
    
    def get_diseases(self) -> Set[str]:
        """Return set of diseases this horse has."""
        return {disease for disease, has_disease in self.diseases.items() if has_disease}
    
    def to_dict(self) -> dict:
        """Convert horse to dictionary for CSV storage."""
        return {
            "name": self.name,
            "sex": self.sex,
            "race": self.race,
            "color": self.color,
            "diseases": json.dumps(self.diseases),
            "exterieur": json.dumps(self.exterieur),
            "interieur": json.dumps(self.interieur),
            "tournament_ratings": json.dumps(self.tournament_ratings)
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "Horse":
        """Create horse from dictionary."""
        return cls(
            name=data["name"],
            sex=data["sex"],
            race=data["race"],
            color=data["color"],
            diseases=json.loads(data["diseases"]),
            exterieur=json.loads(data["exterieur"]),
            interieur=json.loads(data["interieur"]),
            tournament_ratings=json.loads(data.get("tournament_ratings", "{}"))
        )
    
    def __repr__(self) -> str:
        return f"Horse(name={self.name}, sex={self.sex}, race={self.race}, color={self.color})"


def _normalize_pair(token: str) -> str:
    t = token.strip()
    if len(t) != 2:
        return t
    # normalize heterozygous ordering
    if t == "hH":
        return "Hh"
    return t


def _count_to_note(count: int) -> int:
    # Map number of matching loci (0-8) to note 1..5 (1 best)
    if count >= 8:
        return 1
    if 6 <= count <= 7:
        return 2
    if 4 <= count <= 5:
        return 3
    if 2 <= count <= 3:
        return 4
    return 5


def compare_exterieur(parent1: Dict[str, str], parent2: Dict[str, str]):
    """Compare two exterieur dicts and return overall best and worst possible average notes.

    Returns (best_avg_note, worst_avg_note, details)
    where details is a dict per body part with best_count/worst_count and notes.
    """
    details = {}
    best_notes = []
    worst_notes = []

    for part in Horse.BODY_PARTS:
        g1 = parent1.get(part, "")
        g2 = parent2.get(part, "")

        # tokens: first 4 then last 4
        try:
            left1, right1 = [s.strip() for s in g1.split("|")]
            left2, right2 = [s.strip() for s in g2.split("|")]
        except Exception:
            # malformed; assume no matches
            best_notes.append(5)
            worst_notes.append(5)
            details[part] = {"best_count": 0, "worst_count": 0, "best_note": 5, "worst_note": 5}
            continue

        tokens1 = [ _normalize_pair(tok) for tok in (left1.split() + right1.split()) ]
        tokens2 = [ _normalize_pair(tok) for tok in (left2.split() + right2.split()) ]

        # ensure length 8
        if len(tokens1) != 8 or len(tokens2) != 8:
            best_notes.append(5)
            worst_notes.append(5)
            details[part] = {"best_count": 0, "worst_count": 0, "best_note": 5, "worst_note": 5}
            continue

        best_count = 0
        worst_count = 0
        for i in range(8):
            tok1 = tokens1[i]
            tok2 = tokens2[i]
            alleles1 = set(tok1)
            alleles2 = set(tok2)

            if i < 4:
                # desired: presence of H in child (HH or Hh)
                # best possible: achievable if at least one parent has 'H'
                best_possible = ('H' in alleles1) or ('H' in alleles2)
                if best_possible:
                    best_count += 1
                # minimal match guaranteed only if either parent is HH
                guaranteed = (alleles1 == {'H'}) or (alleles2 == {'H'})
                if guaranteed:
                    worst_count += 1
            else:
                # desired: child hh (both alleles h)
                # best possible: achievable if both parents have 'h' allele available
                best_possible = ('h' in alleles1) and ('h' in alleles2)
                guaranteed = (alleles1 == {'h'}) and (alleles2 == {'h'})
                if best_possible:
                    best_count += 1
                if guaranteed:
                    worst_count += 1

        best_note = _count_to_note(best_count)
        worst_note = _count_to_note(worst_count)

        best_notes.append(best_note)
        worst_notes.append(worst_note)
        details[part] = {"best_count": best_count, "worst_count": worst_count, "best_note": best_note, "worst_note": worst_note}

    # average across body parts
    from statistics import mean
    best_avg = mean(best_notes) if best_notes else 5.0
    worst_avg = mean(worst_notes) if worst_notes else 5.0

    return best_avg, worst_avg, details



class HorseDatabase:
    """Manages horse database stored as CSV."""
    
    def __init__(self, csv_path: str | None = "horses.csv"):
        self.csv_path = Path(csv_path) if csv_path is not None else None
        self.horses: Dict[str, Horse] = {}
        if self.csv_path is not None:
            self._load_database()
    
    def _load_database(self):
        """Load horses from CSV file."""
        if self.csv_path is None or not self.csv_path.exists():
            return

        if self.csv_path.stat().st_size == 0:
            # Treat an empty file as an empty database.
            return

        try:
            df = pd.read_csv(self.csv_path)
        except pd.errors.EmptyDataError:
            # Pandas raises this when the file exists but has no columns/data.
            return

        for _, row in df.iterrows():
            horse = Horse.from_dict(row.to_dict())
            self.horses[horse.name] = horse

    def _to_dataframe(self) -> pd.DataFrame:
        data = [horse.to_dict() for horse in self.horses.values()]

        if not data:
            return pd.DataFrame(columns=[
                "name", "sex", "race", "color", "diseases",
                "exterieur", "interieur", "tournament_ratings"
            ])

        return pd.DataFrame(data)

    def replace_from_csv_text(self, csv_text: str) -> None:
        """Replace the current database with horses parsed from CSV text."""
        self.horses = {}

        if not csv_text.strip():
            return

        try:
            df = pd.read_csv(StringIO(csv_text))
        except pd.errors.EmptyDataError:
            return

        for _, row in df.iterrows():
            horse = Horse.from_dict(row.to_dict())
            self.horses[horse.name] = horse

    def export_csv_text(self) -> str:
        """Return the current database as CSV text."""
        buffer = StringIO()
        self._to_dataframe().to_csv(buffer, index=False)
        return buffer.getvalue()
    
    def add_horse(self, horse: Horse) -> None:
        """Add or update a horse in the database."""
        if horse.name in self.horses:
            print(f"Warning: Horse '{horse.name}' already exists. Updating.")
        self.horses[horse.name] = horse
        self._save_database()
    
    def delete_horse(self, horse_name: str) -> None:
        """Delete a horse from the database."""
        if horse_name in self.horses:
            del self.horses[horse_name]
            self._save_database()
            print(f"Horse '{horse_name}' deleted.")
        else:
            print(f"Horse '{horse_name}' not found.")
    
    def get_horse(self, horse_name: str) -> Horse:
        """Retrieve a horse by name."""
        return self.horses.get(horse_name)
    
    def list_horses(self) -> List[Horse]:
        """Return all horses."""
        return list(self.horses.values())
    
    def _save_database(self):
        """Save horses to CSV file."""
        if self.csv_path is None:
            return

        self.csv_path.parent.mkdir(parents=True, exist_ok=True)
        self._to_dataframe().to_csv(self.csv_path, index=False)
        print(f"Database saved to {self.csv_path}")
    
    def __repr__(self) -> str:
        return f"HorseDatabase(horses={len(self.horses)})"

    def _interieur_score(self, value: str) -> float:
        if not isinstance(value, str):
            try:
                return float(value)
            except Exception:
                return 0.0

        v = value.strip().lower()
        mapping = {
            "exzellent": 5.0,
            "gut": 4.0,
            "in ordnung": 3.0,
            "inordnung": 3.0,
            "passabel": 3.0,
            "schlecht": 2.0,
            "miserabel": 1.0
        }
        return mapping.get(v, 0.0)

    def get_best_mates(self, horse_name: str, top_n: int | None = 3):
        """Return a sorted list of mating partners for horse_name.

        If `top_n` is None, return all possible partners in matching order.

        Each entry is a dict: {name, best_avg, worst_avg, interieur_avg, color_note}
        Sorted by best_avg asc, then worst_avg asc (better worst-case).
        """
        if horse_name not in self.horses:
            raise KeyError(f"Horse '{horse_name}' not found")

        subject = self.horses[horse_name]
        candidates = []
        for other in self.horses.values():
            if other.name == subject.name:
                continue
            # opposite sex only
            if other.sex.strip().lower() == subject.sex.strip().lower():
                continue
            # same race only
            if other.race.strip().lower() != subject.race.strip().lower():
                continue

            # skip if they share any genetic disease
            if subject.get_diseases() & other.get_diseases():
                # they have at least one disease in common -> not a valid mate
                continue

            best_avg, worst_avg, _ = compare_exterieur(subject.exterieur, other.exterieur)

            # interieur average (not used for ranking)
            scores = [ self._interieur_score(v) for v in (subject.interieur.values() if subject.interieur else []) ]
            scores += [ self._interieur_score(v) for v in (other.interieur.values() if other.interieur else []) ]
            interieur_avg = (sum(scores) / len(scores)) if scores else 0.0

            color_note = ""
            if subject.color != "/" and other.color != "/" and subject.color.strip().lower() == other.color.strip().lower():
                color_note = f"(both horses are {subject.color})"

            candidates.append({
                "name": other.name,
                "best_avg": best_avg,
                "worst_avg": worst_avg,
                "interieur_avg": interieur_avg,
                "color_note": color_note
            })

        # sort: best_avg asc, tie -> worst_avg asc
        candidates.sort(key=lambda x: (x["best_avg"], x["worst_avg"]))

        if top_n is None:
            return candidates
        return candidates[:top_n]
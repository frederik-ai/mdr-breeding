"""
Command-line interface for horse breeding helper app.
"""

from horses import Horse, HorseDatabase
from typing import Dict


def parse_diseases_from_text(text: str) -> Dict[str, bool]:
    """
    Parse diseases from text input.
    Expected format: "disease1, disease2, disease3" or "CA, HERDA"
    Empty means no diseases.
    """
    diseases = {disease: False for disease in Horse.DISEASES}
    
    if not text.strip():
        return diseases
    
    entered_diseases = [d.strip().upper() for d in text.split(",")]
    for disease in entered_diseases:
        if disease in diseases:
            diseases[disease] = True
        elif disease:  # Non-empty but invalid
            print(f"Warning: Unknown disease '{disease}'. Skipping.")
    
    return diseases


def parse_exterieur_from_text(text: str) -> Dict[str, str]:
    """
    Parse exterieur data from tab-separated input.
    Expected format per line: "BodyPart<tab>GeneCode"
    Example: "Kopf\tHh Hh hh Hh | hh hH hh Hh"
    """
    exterieur = {}
    for line in text.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) != 2:
            print(f"Warning: Invalid exterieur line: '{line}'. Expected 'BodyPart<tab>GeneCode'")
            continue
        body_part, gene_code = parts[0].strip(), parts[1].strip()
        exterieur[body_part] = gene_code
    
    return exterieur


def parse_interieur_from_text(text: str) -> Dict[str, str]:
    """
    Parse interieur data from tab-separated input.
    Expected format per line: "Category<tab>Value"
    Example: "Temperament\tIn Ordnung"
    """
    interieur = {}
    for line in text.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) != 2:
            print(f"Warning: Invalid interieur line: '{line}'. Expected 'Category<tab>Value'")
            continue
        category, value = parts[0].strip(), parts[1].strip()
        interieur[category] = value
    
    return interieur


def add_horse_interactive(db: HorseDatabase) -> None:
    """Interactively add a new horse to the database."""
    print("\n=== Add New Horse ===")
    
    name = input("Horse name: ").strip()
    if not name:
        print("Error: Horse name cannot be empty.")
        return
    
    sex = input("Sex (Stallion/Mare): ").strip()
    race = input("Race: ").strip()
    color = input("Color: ").strip()
    
    # Diseases
    print("\nDiseases (comma-separated, e.g., 'CA, HERDA' or leave empty for none):")
    print(f"Available: {', '.join(sorted(Horse.DISEASES))}")
    disease_input = input("Diseases: ").strip()
    diseases = parse_diseases_from_text(disease_input)
    
    # Exterieur
    print("\nExterieur (paste tab-separated lines, e.g., 'Kopf\\tHh Hh hh Hh | hh hH hh Hh'):")
    print(f"Body parts: {', '.join(Horse.BODY_PARTS)}")
    print("When done, press Enter twice:")
    exterieur_lines = []
    while True:
        line = input()
        if not line:
            if exterieur_lines:
                break
            continue
        exterieur_lines.append(line)
    
    exterieur_text = "\n".join(exterieur_lines)
    exterieur = parse_exterieur_from_text(exterieur_text)
    
    # Interieur
    print("\nInterieur (paste tab-separated lines, e.g., 'Temperament\\tIn Ordnung'):")
    print(f"Categories: {', '.join(Horse.INTERIEUR_CATEGORIES)}")
    print("When done, press Enter twice:")
    interieur_lines = []
    while True:
        line = input()
        if not line:
            if interieur_lines:
                break
            continue
        interieur_lines.append(line)
    
    interieur_text = "\n".join(interieur_lines)
    interieur = parse_interieur_from_text(interieur_text)
    
    try:
        horse = Horse(
            name=name,
            sex=sex,
            race=race,
            color=color,
            diseases=diseases,
            exterieur=exterieur,
            interieur=interieur
        )
        db.add_horse(horse)
        print(f"✓ Horse '{name}' added successfully!")
    except ValueError as e:
        print(f"Error adding horse: {e}")


def list_horses_interactive(db: HorseDatabase) -> None:
    """List all horses in the database."""
    horses = db.list_horses()
    if not horses:
        print("No horses in database.")
        return
    
    print("\n=== Horses in Database ===")
    for i, horse in enumerate(horses, 1):
        diseases = horse.get_diseases()
        disease_str = ", ".join(sorted(diseases)) if diseases else "None"
        print(f"{i}. {horse.name} ({horse.sex}, {horse.color}, {horse.race})")
        print(f"   Diseases: {disease_str}")


def delete_horse_interactive(db: HorseDatabase) -> None:
    """Delete a horse from the database."""
    horses = db.list_horses()
    if not horses:
        print("No horses in database.")
        return
    
    print("\n=== Delete Horse ===")
    for i, horse in enumerate(horses, 1):
        print(f"{i}. {horse.name}")
    
    try:
        choice = int(input("Select horse number to delete (0 to cancel): ").strip())
        if choice == 0:
            return
        if 1 <= choice <= len(horses):
            horse_name = horses[choice - 1].name
            confirm = input(f"Delete '{horse_name}'? (yes/no): ").strip().lower()
            if confirm == "yes":
                db.delete_horse(horse_name)
            else:
                print("Cancelled.")
        else:
            print("Invalid selection.")
    except ValueError:
        print("Invalid input.")


def view_horse_details(db: HorseDatabase) -> None:
    """View detailed information about a horse."""
    horses = db.list_horses()
    if not horses:
        print("No horses in database.")
        return
    
    print("\n=== View Horse Details ===")
    for i, horse in enumerate(horses, 1):
        print(f"{i}. {horse.name}")
    
    try:
        choice = int(input("Select horse number (0 to cancel): ").strip())
        if choice == 0:
            return
        if 1 <= choice <= len(horses):
            horse = horses[choice - 1]
            print(f"\n--- {horse.name} ---")
            print(f"Sex: {horse.sex}")
            print(f"Race: {horse.race}")
            print(f"Color: {horse.color}")
            print(f"\nDiseases: {', '.join(sorted(horse.get_diseases())) if horse.get_diseases() else 'None'}")
            print(f"\nExterieur:")
            for part, genes in horse.exterieur.items():
                print(f"  {part}: {genes}")
            print(f"\nInterieur:")
            for cat, value in horse.interieur.items():
                print(f"  {cat}: {value}")
        else:
            print("Invalid selection.")
    except ValueError:
        print("Invalid input.")


def find_best_mates_interactive(db: HorseDatabase) -> None:
    """Find and display best mating partners for a selected horse."""
    horses = db.list_horses()
    if not horses:
        print("No horses in database.")
        return

    print("\n=== Find Best Mates ===")
    for i, horse in enumerate(horses, 1):
        print(f"{i}. {horse.name}")

    try:
        choice = int(input("Select horse number (0 to cancel): ").strip())
        if choice == 0:
            return
        if 1 <= choice <= len(horses):
            subject = horses[choice - 1]
            try:
                resp = input("How many partners to show? (leave empty for all): ").strip()
                top_n = None if resp == "" else int(resp)
            except ValueError:
                top_n = None

            partners = db.get_best_mates(subject.name, top_n=top_n)
            if not partners:
                print("No suitable partners found.")
                return

            print(f"\nBest {len(partners)} partners for {subject.name}:")
            print("| Name | Best Possible Exterieur Outcome | Worst Possible Exterieur Outcome | Note")
            for p in partners:
                print(f"| {p['name']} | {p['best_avg']:.2f} | {p['worst_avg']:.2f} | {p['color_note']}")
        else:
            print("Invalid selection.")
    except ValueError:
        print("Invalid input.")


def main():
    """Main CLI loop."""
    db = HorseDatabase("horses.csv")
    
    print("🐴 Horse Breeding Helper App")
    print("=" * 40)
    
    while True:
        print("\n--- Main Menu ---")
        print("1. Add horse")
        print("2. List horses")
        print("3. View horse details")
        print("4. Delete horse")
        print("6. Find best mates")
        print("5. Exit")
        
        choice = input("\nSelect option: ").strip()
        
        if choice == "1":
            add_horse_interactive(db)
        elif choice == "2":
            list_horses_interactive(db)
        elif choice == "3":
            view_horse_details(db)
        elif choice == "4":
            delete_horse_interactive(db)
        elif choice == "6":
            find_best_mates_interactive(db)
        elif choice == "5":
            print("Goodbye! 🐴")
            break
        else:
            print("Invalid option.")


if __name__ == "__main__":
    main()

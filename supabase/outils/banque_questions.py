"""
Banque de questions du coffre du scan (étape 6.3 bis), source : QUESTIONS-DOMAF.md.

  python supabase/outils/banque_questions.py      → insert SQL (à coller dans 01_reference.sql)
  python supabase/outils/banque_questions.py js   → bloc banqueQuestions (à coller dans app/data/mock.js)

Les deux copies doivent rester identiques. Ne jamais changer une « valeur » une fois
le festival commencé : les réponses déjà données y renvoient.
"""
import json, sys, unicodedata, re

def slug(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:24]

# (code, theme, moment, chaque_jour, ordre_fixe, type, question, options)
# une option finissant par « * » reste en bas même quand l'ordre est mélangé
B = [
 ("S1","venue","toujours",False,False,"choix","Tu es venu comment aujourd'hui ?",["À pied","Moto-taxi","Taxi","Voiture personnelle","Bus"]),
 ("S2","venue","toujours",False,False,"choix","Tu as connu le DOMAF comment ?",["Un ami m'en a parlé","Facebook ou Instagram","TikTok","WhatsApp","Radio ou télé","Une affiche","Autrement*"]),
 ("S3","venue","toujours",False,True,"choix","C'est ton combientième DOMAF ?",["Mon tout premier","Le 2e ou le 3e","Je viens presque chaque année"]),
 ("S4","venue","toujours",False,False,"choix","Tu es venu avec qui ?",["Seul","Avec des amis","En couple","En famille","Avec des collègues"]),
 ("S6","venue","toujours",False,False,"choix","Tu écoutes ta musique surtout où ?",["Sur une appli de streaming","Sur YouTube","Sur TikTok","À la radio","En concert, surtout"]),
 ("S7","ecoute","toujours",False,False,"choix","Ton appli de musique principale ?",["Boomplay","Audiomack","Spotify","YouTube Music","Apple Music","Deezer","Aucune*"]),
 ("S8","ecoute","toujours",False,True,"choix","Tu paies un abonnement musique ?",["Oui","Non, la version gratuite me suffit","Non, je n'utilise pas d'appli"]),
 ("S9","ecoute","toujours",False,True,"choix","Tu écoutes de la musique combien de temps par jour ?",["Moins d'1 h","1 à 3 h","3 à 5 h","Plus de 5 h"]),
 ("S10","ecoute","toujours",False,False,"choix","Tu écoutes surtout…",["Des artistes camerounais","Des artistes africains","Des artistes internationaux","Un peu de tout*"]),
 ("S11","ecoute","toujours",False,True,"choix","La radio, tu l'écoutes ?",["Tous les jours","De temps en temps","Jamais"]),
 ("S12","ecoute","toujours",False,False,"choix","Tu écoutes la musique sur quoi ?",["Le téléphone","Des écouteurs Bluetooth","Une enceinte","La télé","En voiture"]),
 ("S13","gouts","toujours",False,False,"choix","Ton 2e genre préféré ?",["Afrobeats / Afro-pop","Makossa","Bikutsi","Coupé-décalé","Rap / Hip-hop","R&B / Soul","Gospel","Reggae / Dancehall","Rumba / Ndombolo","Jazz","Électro","Zouk / Kompa","Un autre*"]),
 ("S14","gouts","toujours",False,False,"choix","Tu découvres les nouveaux artistes surtout par…",["TikTok","Instagram","YouTube","La radio","Les amis","Les concerts"]),
 ("S15","gouts","toujours",False,True,"choix","Tu as déjà acheté un morceau ou un album ?",["Oui, en ligne","Oui, un CD","Jamais"]),
 ("S16","gouts","toujours",False,True,"choix","Tu suis des artistes sur les réseaux ?",["Oui, beaucoup","Quelques-uns","Non"]),
 ("S17","gouts","toujours",False,True,"choix","Tu préfères…",["Les grandes stars","Les nouveaux talents","Les deux"]),
 ("S18","gouts","toujours",False,True,"choix","Tu fais toi-même de la musique ou de la danse ?",["Oui, c'est mon métier","Oui, pour le plaisir","Non"]),
 ("S19","sorties","toujours",False,True,"choix","Tu sors (maquis, boîte, concert) combien de fois par mois ?",["Jamais","1 à 2 fois","3 à 5 fois","Plus de 5 fois"]),
 ("S20","sorties","toujours",False,True,"choix","Ton budget sorties par mois ?",["Moins de 10 000 FCFA","10 000 à 25 000 FCFA","25 000 à 50 000 FCFA","Plus de 50 000 FCFA"]),
 ("S21","sorties","toujours",False,False,"choix","Tes billets de concert, tu les achètes…",["En ligne","Sur place","Chez un revendeur","On me les offre"]),
 ("S22","sorties","toujours",False,False,"choix","Tu paies surtout avec…",["MTN Mobile Money","Orange Money","Espèces","Carte bancaire"]),
 ("S23","sorties","toujours",False,True,"choix","Un concert à 5 000 FCFA, c'est…",["Pas cher","Correct","Trop cher"]),
 ("S24","partenaires","toujours",False,False,"choix","Ton opérateur mobile principal ?",["MTN","Orange","Camtel / Blue","Nexttel"]),
 ("S25","partenaires","toujours",False,True,"choix","Ton forfait internet, tu l'achètes…",["Chaque jour","Chaque semaine","Chaque mois"]),
 ("S26","partenaires","toujours",False,False,"choix","Ton téléphone, c'est…",["Un Android","Un iPhone","Un téléphone simple"]),
 ("S27","partenaires","toujours",False,False,"choix","Le réseau social que tu ouvres le plus ?",["WhatsApp","TikTok","Facebook","Instagram","Snapchat","X"]),
 ("S28","partenaires","toujours",False,False,"choix","Au festival, tu bois plutôt…",["De la bière","Du soda","Du jus","De l'eau","Un énergisant","Rien*"]),
 ("S30","partenaires","toujours",False,False,"choix","Tu manges quoi au festival ?",["Grillades / soya","Plats locaux","Fast-food","Rien, je mange avant*"]),
 ("S31","profil","toujours",False,True,"choix","Tu vis à Douala depuis…",["Toujours","Plus de 5 ans","Moins de 5 ans","Je n'y vis pas"]),
 ("S32","profil","toujours",False,False,"choix","À la maison, tu parles surtout…",["Français","Anglais","Pidgin","Une langue locale"]),
 ("S33","profil","toujours",False,True,"choix","Tu as des enfants ?",["Oui","Non"]),
 ("N1","soir","soir",True,True,"choix","Ta journée, tu la notes comment ?",["Décevante","Moyenne","Bien","Très bien","Inoubliable"]),
 ("N2","soir","soir",True,True,"artiste","Ton concert préféré aujourd'hui ?",[]),
 ("N3","soir","soir",True,False,"choix","Ce qui t'a le plus plu aujourd'hui ?",["La musique","L'ambiance","Le jeu DOMAF Quest","La nourriture","L'organisation","Les rencontres"]),
 ("N4","soir","soir",True,True,"choix","L'attente à l'entrée ?",["Rapide","Correcte","Trop longue"]),
 ("N5","soir","soir",True,True,"choix","L'attente au bar ?",["Rapide","Correcte","Trop longue"]),
 ("N6","soir","soir",True,True,"choix","L'attente aux food-trucks ?",["Rapide","Correcte","Trop longue"]),
 ("N7","soir","soir",True,True,"choix","Les toilettes ?",["Propres et rapides","Correctes","À revoir"]),
 ("N8","soir","soir",True,True,"choix","Combien as-tu dépensé aujourd'hui, sans le billet ?",["Rien du tout","Moins de 2 000 FCFA","2 000 à 5 000 FCFA","5 000 à 10 000 FCFA","Plus de 10 000 FCFA"]),
 ("N9","soir","soir",True,False,"choix","Ce qu'on doit améliorer en priorité ?",["Plus de stands","Moins d'attente","Plus d'activités","Plus de place","La nourriture","Rien, c'était bien*"]),
 ("N10","soir","soir",False,True,"choix","Conseillerais-tu DOMAF Quest à un ami ? (0 = pas du tout, 10 = carrément)",[str(i) for i in range(11)]),
 ("N11","soir","soir",False,True,"choix","Tu reviendras au DOMAF l'an prochain ?",["Oui, sûr","Peut-être","Non"]),
]

def q(t): return "'" + t.replace("'", "''") + "'"

lignes = []
for i, (code, theme, moment, cj, fixe, typ, question, opts) in enumerate(B, 1):
    o = []
    for lib in opts:
        bas = lib.endswith("*")
        lib = lib.rstrip("*")
        e = {"valeur": slug(lib) if not lib.isdigit() else lib, "libelle": lib}
        if bas: e["bas"] = True
        o.append(e)
    vals = [x["valeur"] for x in o]
    assert len(vals) == len(set(vals)), code
    lignes.append(f" ({i}, {i}, {q(code)}, {q(theme)}, {q(moment)}, {str(cj).lower()}, {str(fixe).lower()}, {q(typ)},\n  {q(question)},\n  {q(json.dumps(o, ensure_ascii=False))}::jsonb)")

sql = ("insert into public.micro_questions (id, ordre, code, theme, moment, chaque_jour, ordre_fixe, type, question, options) values\n"
       + ",\n".join(lignes) + "\non conflict (id) do nothing;\n")
sys.stdout.reconfigure(encoding="utf-8")
if len(sys.argv) == 1: print(sql, end="")

# --- Version démo (mock.js) ---
if len(sys.argv) > 1 and sys.argv[1] == "js":
    out = []
    for i, (code, theme, moment, cj, fixe, typ, question, opts) in enumerate(B, 1):
        o = []
        for lib in opts:
            bas = lib.endswith("*"); lib = lib.rstrip("*")
            e = {"valeur": slug(lib) if not lib.isdigit() else lib, "libelle": lib}
            if bas: e["bas"] = True
            o.append(e)
        q2 = {"id": i, "code": code, "theme": theme, "moment": moment, "chaqueJour": cj, "ordreFixe": fixe, "type": typ, "question": question}
        if o: q2["options"] = o
        out.append("    " + json.dumps(q2, ensure_ascii=False))
    print("  banqueQuestions: [\n" + ",\n".join(out) + "\n  ],")

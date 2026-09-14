#!/usr/bin/env python3
"""Resolve every language name in the catalogue to an ISO 639-3 code.

Output: data/language_codes.json, a registry keyed by BCP 47 tag whose primary
subtag is always a three-letter ISO 639-3 code. Regional varieties of a colonial
language carry an ISO 3166-1 alpha-2 region subtag, so Nigerian English is
eng-NG rather than a separate invented code.

Names the registry cannot resolve are reported, never guessed.
"""
from __future__ import annotations
import json, re, sys, unicodedata
from pathlib import Path
import pycountry

ROOT = Path(__file__).resolve().parent.parent

def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z ]", " ", s.lower()).strip()

def squash(s: str) -> str:
    return re.sub(r"\s+", " ", norm(s))

# ISO 639-3 registry from pycountry, name -> alpha_3
REGISTRY: dict[str, str] = {}
for _l in pycountry.languages:
    _a3 = getattr(_l, "alpha_3", None)
    if not _a3:
        continue
    for _attr in ("name", "common_name", "inverted_name"):
        _v = getattr(_l, _attr, None)
        if _v:
            REGISTRY.setdefault(squash(_v), _a3)

# Preferred display names where the ISO register's own label reads badly.
PREFERRED = {
  "swh":"Swahili","gaz":"Oromo","plt":"Malagasy","nya":"Chichewa","nso":"Sepedi",
  "nbl":"isiNdebele","nde":"Northern Ndebele","ssw":"siSwati","tsn":"Setswana",
  "sot":"Sesotho","zul":"isiZulu","xho":"isiXhosa","tso":"Xitsonga","ven":"Tshivenda",
  "luo":"Dholuo","lug":"Luganda","luy":"Luhya","kln":"Kalenjin","teo":"Ateso",
  "nyn":"Runyankole","cgg":"Rukiga","nyo":"Runyoro","ttj":"Rutooro","xog":"Lusoga",
  "lua":"Tshiluba","kon":"Kikongo","ktu":"Kituba","swc":"Congolese Swahili",
  "ful":"Fula","fuc":"Pulaar","fuf":"Pular","fuv":"Nigerian Fulfulde","emk":"Maninka",
  "arb":"Modern Standard Arabic","ary":"Moroccan Arabic","arq":"Algerian Arabic",
  "aeb":"Tunisian Arabic","arz":"Egyptian Arabic","mey":"Hassaniya Arabic",
  "apd":"Sudanese Arabic","ayl":"Libyan Arabic","shu":"Chadian Arabic","pga":"Juba Arabic",
  "aec":"Sa'idi Arabic","kea":"Kabuverdianu","pov":"Guinea-Bissau Creole","mfe":"Mauritian Creole",
  "crs":"Seychellois Creole","rcf":"Reunion Creole","zdj":"Comorian (Shingazidja)",
  "wlc":"Comorian (Shimwali)","wni":"Comorian (Shinzwani)","swb":"Comorian (Shimaore)",
  "pcm":"Nigerian Pidgin","wes":"Cameroonian Pidgin","gpe":"Ghanaian Pidgin",
  "kri":"Krio","lir":"Liberian Kreyol","fly":"Tsotsitaal","fng":"Fanagalo",
  "naq":"Khoekhoegowab","her":"Otjiherero","ndo":"Oshiwambo","kwn":"Rukwangali",
  "ktz":"Ju|'hoansi","ngh":"N|uu","nmn":"!Xoon","toi":"Tonga","loz":"Silozi",
  "vmw":"Emakhuwa","seh":"Sena","ngl":"Lomwe","sid":"Sidama","wal":"Wolaytta",
  "sgw":"Gurage","shi":"Tashelhiyt","tzm":"Central Atlas Tamazight","zgh":"Standard Moroccan Tamazight",
  "taq":"Tamasheq","ttq":"Tamajaq","thv":"Tamahaq","shy":"Chaoui","rif":"Tarifit",
  "twi":"Twi","fat":"Fante","aka":"Akan","dga":"Dagaare","gur":"Gurune","mos":"More",
  "dyu":"Dioula","dje":"Zarma","bci":"Baoule","spp":"Supyire Senoufo","wob":"Were Northern",
  "xpe":"Kpelle (Liberia)","gkp":"Kpelle (Guinea)","mev":"Mano","klu":"Klao",
  "bsq":"Bassa","bas":"Basaa","bum":"Bulu","bbj":"Ghomala","byv":"Medumba",
}

def _clean(n: str) -> str:
    n = re.sub(r"\s*\((individual language|macrolanguage)\)", "", n)
    return n.strip()

def iso_name(code: str) -> str | None:
    if code in PREFERRED:
        return PREFERRED[code]
    rec = pycountry.languages.get(alpha_3=code)
    return _clean(getattr(rec, "name", "")) or None if rec else None

def country_name(alpha_2: str) -> str:
    rec = pycountry.countries.get(alpha_2=alpha_2)
    return getattr(rec, "common_name", None) or getattr(rec, "name", alpha_2) if rec else alpha_2

# Curated map. Value is either "iso3" or "iso3-RR" (BCP 47 with a region subtag).
# Every entry here was chosen because the plain registry lookup is wrong or absent:
# local orthographies, country-specific varieties, cluster names and common aliases.
CURATED: dict[str, str] = {
  # Swahili and its varieties
  "swahili":"swh","kiswahili":"swh","swahili kenyan":"swh-KE","swahili tanzanian":"swh-TZ",
  "congolese swahili":"swc","kingwana":"swc","swahili congolese":"swc",
  # Southern Bantu, local orthographies
  "isizulu":"zul","isixhosa":"xho","sesotho":"sot","southern sotho":"sot","setswana":"tsn",
  "sepedi":"nso","northern sotho":"nso","sepedi northern sotho":"nso","xitsonga":"tso",
  "tshivenda":"ven","siswati":"ssw","swazi":"ssw","isindebele":"nbl","southern ndebele":"nbl",
  "northern ndebele":"nde","ndebele":"nde","shangani":"tso","changana":"tso","xichangana":"tso",
  "chishona":"sna","kalanga":"kck","nambya":"nmq","shekgalagari":"xkv",
  # Zambia, Malawi, Mozambique, Angola
  "bemba":"bem","icibemba":"bem","nyanja":"nya","chichewa":"nya","nyanja chichewa":"nya",
  "chewa":"nya","tonga":"toi","chitonga":"toi","silozi":"loz","lozi":"loz","lunda":"lun",
  "luvale":"lue","kaonde":"kqn","emakhuwa":"vmw","makhuwa":"vmw","sena":"seh","lomwe":"ngl",
  "ndau":"ndc","tswa":"tsc","ronga":"rng","chuwabo":"chw","makonde":"kde",
  "umbundu":"umb","kimbundu":"kmb","chokwe":"cjk","nganguela":"nba","fiote":"vif","vili":"vif",
  "yao":"yao","tumbuka":"tum",
  # Namibia and Botswana
  "khoekhoegowab":"naq","khoekhoegowab damara nama":"naq","nama":"naq","damara":"naq",
  "otjiherero":"her","herero":"her","oshiwambo":"ndo","oshiwambo ndonga":"ndo",
  "oshindonga":"ndo","oshikwanyama":"kua","kwanyama":"kua","rukwangali":"kwn","kwangali":"kwn",
  "juhoansi":"ktz","ju hoansi":"ktz","juhoansi san services":"ktz",
  "ju hoansi san services":"ktz","nuu":"ngh","n uu":"ngh","xoon":"nmn","xoon ":"nmn",
  "naro":"nhr","balanta":"ble","balanta kentohe":"ble","balanta ganja":"bjt",
  "namibian german":"deu-NA","namibian english":"eng-NA",
  # Great Lakes and East Africa
  "luganda":"lug","ganda":"lug","luhya":"luy","luhia":"luy","bukusu":"bxk",
  "dholuo":"luo","dholuo luo":"luo","luo":"luo","kamba":"kam","kikamba":"kam","maasai":"mas",
  "maa":"mas","kikuyu":"kik","gikuyu":"kik","kalenjin":"kln","meru":"mer","kimeru":"mer",
  "taita dawida":"dav","taita":"dav","acholi":"ach","ateso":"teo","teso":"teo",
  "runyankole":"nyn","runyankore":"nyn","rukiga":"cgg","chiga rukiga":"cgg","chiga":"cgg",
  "runyoro":"nyo","rutooro":"ttj","runyoro rutooro":"nyo","lusoga":"xog","soga":"xog",
  "lango":"laj","langi":"laj","lugbara":"lgg","amba":"rwm","kirundi":"run","rundi":"run",
  "sukuma":"suk","haya":"hay","nyakyusa":"nyy","gogo":"gog","hehe":"heh",
  "ruuli":"ruc","kinyarwanda":"kin",
  # Horn of Africa
  "sidama":"sid","sidaama":"sid","wolaytta":"wal","wolaita":"wal","afar":"aar",
  "hadiyya":"hdy","siltie":"stv","silte":"stv","gamo":"gmv","kafa":"kbr","kaffa":"kbr",
  "awngi":"awn","agaw":"awn","gurage":"sgw","sebat bet gurage":"sgw","geez":"gez",
  "tigre":"tig","bilen":"byn","blin":"byn","kunama":"kun","nara":"nrb","saho":"ssy",
  "maay maay":"ymm","maay":"ymm","oromo":"gaz","afaan oromoo":"gaz","oromo afaan oromoo":"gaz",
  # Nilotic and South Sudan
  "dinka":"din","nuer":"nus","bari":"bfa","shilluk":"shk","toposa":"toq","zande":"zne",
  # Central Africa
  "kikongo":"kon","kongo":"kon","kituba":"ktu","munukutuba":"ktu","tshiluba":"lua",
  "luba kasai":"lua","luba":"lua","mongo":"lol","sango":"sag","gbaya":"gba","banda":"bad",
  "fang":"fan","bubi":"bvb","myene":"mye","punu":"puu","teke":"tek",
  "basaa":"bas","bassa cameroon":"bas","bulu":"bum","ewondo":"ewo","eton":"eto",
  "ghomala":"bbj","ghomala'":"bbj","kom":"bkm","mbo":"mbo","mada":"mxu","duala":"dua",
  "medumba":"byv","bafut":"bfd","ngiemboon":"nnh","sara":"mwm","ngambay":"sba","kanembu":"kbl",
  # West Africa, Nigeria
  "nigerian pidgin":"pcm","naija":"pcm","west african pidgin english":"pcm",
  "efik":"efi","ibibio":"ibb","tiv":"tiv","edo":"bin","bini":"bin","nupe":"nup",
  "idoma":"idu","igala":"igl","ijaw":"ijc","izon":"ijc","urhobo":"urh","isoko":"iso",
  "ebira":"igb","berom":"bom","kanuri":"knc","gbagyi":"gbr","standard yoruba":"yor",
  "ife yoruba":"yor","ijebu yoruba":"yor","ilaje yoruba":"yor","ehugbo igbo":"ibo",
  # Ghana, Togo, Benin
  "akan":"aka","twi":"twi","asante twi":"twi","akuapem twi":"twi","fante":"fat","fanti":"fat",
  "ga":"gaa","dagbani":"dag","dagaare":"dga","gurune":"gur","frafra":"gur","kusaal":"kus",
  "nzema":"nzi","ahanta":"aha","sehwi":"sfw","ikposo":"kpo","ghanaian pidgin":"gpe",
  "fon":"fon","bariba":"bba","dendi":"ddn","aja":"ajg","kabiye":"kbp","tem":"kdh",
  "moba":"mfq","lama":"las","konkomba":"xon","bassar":"ntm","nawdm":"nmz","gen mina":"gej",
  "gen":"gej","mina":"gej",
  # Senegal, Mali, Burkina, Niger, Guinea
  "wolof":"wol","pulaar":"fuc","fulani pulaar":"fuc","sereer":"srr","serer":"srr",
  "jola":"dyo","diola":"dyo","mandinka":"mnk","mandinka mandingo":"mnk","soninke":"snk",
  "bambara":"bam","dioula":"dyu","jula":"dyu","dioula jula":"dyu","songhay":"son",
  "zarma":"dje","djerma":"dje","moore":"mos","mossi":"mos","gourmanchema":"gux",
  "bissa":"bib","tubu":"tuq","tudaga":"tuq","buduma":"bdm","maninka":"emk","koniaka":"mku",
  "susu":"sus","pular":"fuf","kissi":"kss","eastern kissi":"kss","guerze":"gkp",
  "guerze kpelle":"gkp","kpelle guerze":"gkp","toma":"tod","loma toma":"lom","loma":"lom",
  "fula":"ful","fulani":"ful","fulfulde":"ful","tamasheq":"taq","tamajaq":"ttq",
  # Sierra Leone, Liberia, Cote d'Ivoire, Cape Verde, Guinea-Bissau
  "krio":"kri","mende":"men","temne":"tem","limba":"lia","kono":"kno","kuranko":"knk",
  "kuranko koranko":"knk","krim":"krm","sherbro":"bun","loko":"lok",
  "sierra leonean english":"eng-SL","bassa":"bsq","klao":"klu","klao kru":"klu","kru":"klu",
  "vai":"vai","mano":"mev","mano maan":"mev","grebo":"grj","liberian kreyol":"lir",
  "liberian pidgin english":"lir","kpelle":"xpe",
  "baoule":"bci","baoule bci":"bci","bete":"bet","supyire senoufo":"spp","senoufo":"spp",
  "attie":"ati","anyin":"any","abidji":"abi","ebrie":"ebr","we northern guere wobe":"wob",
  "guere":"wob","cape verdean creole":"kea","cape verdean creole kabuverdianu":"kea",
  "kabuverdianu":"kea","cape verdean creole barlavento":"kea",
  "guinea bissau creole":"pov","kriol":"pov",
  # Sao Tome and Equatorial Guinea creoles
  "forro":"cri","santomense":"cri","angolar":"aoa","principense":"pre","annobonese":"fab",
  "pichinglis":"fpe","cameroonian pidgin english":"wes","cameroonian pidgin":"wes",
  # Islands
  "malagasy":"plt","malagasy merina plateau":"plt","merina":"plt","mauritian creole":"mfe",
  "kreol morisien":"mfe","seychellois creole":"crs","seselwa":"crs","reunion creole":"rcf",
  "comorian":"zdj","comorian shingazidja":"zdj","comorian shimwali":"wlc",
  "comorian shinzwani":"wni","comorian shimaore":"swb","shimaore":"swb",
  "comorian shindzwani":"wni","comorian shikomori":"zdj","kibushi":"buc","kibushi bushi":"buc",
  "bhojpuri mauritian":"bho-MU",
  # Arabic and Berber
  "modern standard arabic":"arb","arabic msa":"arb","modern standard arabic quranic":"arb",
  "modern standard arabic tunisian speakers":"arb-TN",
  "modern standard arabic tunisian accented":"arb-TN",
  "modern colloquial arabic moroccan":"ary","modern colloquial arabic tunisian":"aeb",
  "saidi arabic":"aec","sa idi arabic":"aec",
  "moroccan arabic darija":"ary","darija":"ary","algerian arabic darja":"arq",
  "tunisian arabic arabizi":"aeb","cairene arabic":"arz","hassaniya arabic":"mey",
  "hassaniya":"mey","shuwa arabic":"shu","chadian arabic":"shu","juba arabic":"pga",
  "maghrebi arabic":"ary","libyan arabic":"ayl","sudanese arabic":"apd",
  "kabyle":"kab","bougiote bejaia kabyle":"kab","tasahlite eastern kabyle":"kab",
  "tashlhiyt":"shi","tashelhit":"shi","tarifit":"rif","chaoui":"shy","shawiya":"shy",
  "central atlas tamazight":"tzm","standard moroccan tamazight":"zgh","siwi":"siz",
  "nafusi":"jbn","zenaga":"zen","tamahaq":"thv","nobiin":"fia","kenuzi dongola":"kzh",
  "fur":"fvr","zaghawa":"zag","beja":"bej","coptic":"cop",
  # Colonial-language varieties, region-tagged
  "south african english":"eng-ZA","english south african":"eng-ZA",
  "nigerian english":"eng-NG","english nigeria":"eng-NG","english nigerian":"eng-NG",
  "ghanaian english":"eng-GH","english ghanaian":"eng-GH","kenyan english":"eng-KE",
  "english kenyan":"eng-KE","ugandan english":"eng-UG","english ugandan":"eng-UG",
  "tanzanian english":"eng-TZ","english tanzanian":"eng-TZ","rwandan english":"eng-RW",
  "english rwandan":"eng-RW","zimbabwean english":"eng-ZW","malawian english":"eng-MW",
  "zambian english":"eng-ZM","ethiopian english":"eng-ET","ivorian english":"eng-CI",
  "cameroonian english":"eng-CM","botswana english":"eng-BW","lesotho english":"eng-LS",
  "eswatini english":"eng-SZ","south sudanese english":"eng-SS",
  "cameroonian french":"fra-CM","congolese french":"fra-CD","chadian french":"fra-TD",
  "gabonese french":"fra-GA","ivorian french":"fra-CI","djiboutian french":"fra-DJ",
  "french burundian":"fra-BI","senegalese french":"fra-SN","malian french":"fra-ML",
  "beninese french":"fra-BJ","togolese french":"fra-TG","burkinabe french":"fra-BF",
  "guinean french":"fra-GN","rwandan french":"fra-RW","moroccan french":"fra-MA",
  "tunisian french":"fra-TN","algerian french":"fra-DZ","malagasy french":"fra-MG",
  "mauritian french":"fra-MU","comorian french":"fra-KM","car french":"fra-CF",
  "mozambican portuguese":"por-MZ","portuguese mozambique":"por-MZ",
  "angolan portuguese":"por-AO","cape verdean portuguese":"por-CV",
  "sao tome portuguese":"por-ST","bissau guinean portuguese":"por-GW",
  "equatoguinean spanish":"spa-GQ",
  "afrikaans cape coloured variety":"afr-ZA","afrikaans coloured variety":"afr-ZA",
  "afrikaans l bantu l speakers":"afr-ZA",
  "south african english black south african english":"eng-ZA",
  "south african english coloured cape flats variety":"eng-ZA",
  "senhaja de srair northern moroccan berber":"sjs","senhaja de srair":"sjs",
  "arabic dialects":"ara","english accented l and l":"eng",
  # Urban vernaculars and mixed codes
  "fanagalo":"fng","tsotsitaal":"fly","flaaitaal":"fly","tsotsitaal sabela":"fly",
}

# Names that are not languages, or are groups too broad to pin to one code.
# Recorded explicitly so nothing is silently dropped.
NON_LANGUAGE = {
  "multiple":"placeholder used by a source instead of naming its languages",
  "various":"placeholder used by a source instead of naming its languages",
  "commissioned per project":"a collection arrangement, not a language",
}
REGIONAL_GROUP = {
  "english african accented":"eng","african accented english":"eng","english accented":"eng",
  "english east africa":"eng","english east african":"eng","english southern africa":"eng",
  "english arabic berber accented":"eng","french african accented":"fra",
  "french central africa":"fra","french north africa":"fra",
  "french west central african accents":"fra",
  "ebira accented english":"eng-NG","hausa accented english":"eng-NG",
  "idoma accented english":"eng-NG","igala accented english":"eng-NG",
  "igbo accented english":"eng-NG","ijaw accented english":"eng-NG",
  "isoko accented english":"eng-NG","urhobo accented english":"eng-NG",
  "yoruba accented english":"eng-NG",
  "nouchi":"fra-CI","camfranglais":"fra-CM","sheng":"swh-KE",
  "dogon":None, "chagga":None, "bete":None,
}

def resolve(name: str) -> tuple[str | None, str]:
    """Return (bcp47 tag, how) for a language name."""
    key = squash(name)
    if key in NON_LANGUAGE:
        return None, "not-a-language"
    if key in CURATED:
        return CURATED[key], "curated"
    if key in REGISTRY:
        return REGISTRY[key], "iso-registry"
    if key in REGIONAL_GROUP:
        tag = REGIONAL_GROUP[key]
        return (tag, "group") if tag else (None, "cluster-no-single-code")
    # strip a trailing parenthetical, e.g. "Taita (Dawida)"
    stripped = squash(re.sub(r"\(.*?\)", " ", name))
    if stripped and stripped != key:
        if stripped in CURATED: return CURATED[stripped], "curated-stripped"
        if stripped in REGISTRY: return REGISTRY[stripped], "iso-registry-stripped"
    return None, "unresolved"

DESCRIPTIVE = re.compile(
    r"\d|\b(languages|dialects|varieties|multiple|various|several|many|thousands|"
    r"hundreds|subsets|others|etc)\b", re.I)

def source_names() -> list[str]:
    """Every language spelling the catalogue actually uses, in first-seen order.

    Read from the catalogue rather than the language index so this script stays
    idempotent: it must not consume its own output.
    """
    cat = json.loads((ROOT / "data/catalogue.json").read_text(encoding="utf-8"))
    seen: dict[str, None] = {}
    for rec in cat:
        for name in rec.get("languages") or []:
            if isinstance(name, str) and name.strip():
                seen.setdefault(name.strip(), None)
    return list(seen)

def main() -> int:
    out: dict[str, dict] = {}
    names: dict[str, str] = {}
    unresolved: list[str] = []
    descriptive: list[str] = []
    for name in source_names():
        tag, how = resolve(name)
        if not tag:
            if how == "unresolved":
                (descriptive if DESCRIPTIVE.search(name) else unresolved).append(name)
            names[name] = ""
            continue
        names[name] = tag
        base, _, region = tag.partition("-")
        rec = out.setdefault(tag, {
            "tag": tag, "iso639_3": base, "region": region or None,
            "name": iso_name(base) or name, "aliases": [], "resolution": how,
        })
        if name not in rec["aliases"]:
            rec["aliases"].append(name)
    for rec in out.values():
        rec["aliases"].sort()
        if rec["region"]:
            base = iso_name(rec["iso639_3"]) or rec["iso639_3"]
            rec["name"] = f'{base} ({country_name(rec["region"])})'
        macro = pycountry.languages.get(alpha_3=rec["iso639_3"])
        rec["scope"] = getattr(macro, "scope", None) if macro else None
        rec["type"] = getattr(macro, "type", None) if macro else None
    (ROOT / "data/language_codes.json").write_text(
        json.dumps({"$comment":
            "Language identity for ngano. The key and `tag` are BCP 47; the primary subtag is "
            "always an ISO 639-3 three-letter code. A region subtag marks a country-specific "
            "variety, so Nigerian English is eng-NG rather than an invented code. `aliases` "
            "lists every catalogue spelling that resolves here. Generated by "
            "scripts/build_language_codes.py; edit the curated table there, not this file.",
            "version": 1, "codes": out, "name_to_tag": names,
            "not_a_language": NON_LANGUAGE,
            "descriptive": sorted(descriptive)}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    print(f"names: {len(names)} -> tags: {len(out)}")
    print(f"descriptive phrases (no single code, kept as prose): {len(descriptive)}")
    print(f"unresolved: {len(unresolved)}")
    for n in unresolved:
        print("  ", n)
    return 1 if unresolved else 0

if __name__ == "__main__":
    raise SystemExit(main())

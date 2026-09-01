import re


ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
ORDINALS = {1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth", 7: "seventh", 8: "eighth", 9: "ninth", 10: "tenth", 11: "eleventh", 12: "twelfth", 13: "thirteenth", 14: "fourteenth", 15: "fifteenth", 16: "sixteenth", 17: "seventeenth", 18: "eighteenth", 19: "nineteenth", 20: "twentieth", 21: "twenty-first", 22: "twenty-second", 23: "twenty-third", 24: "twenty-fourth", 25: "twenty-fifth", 26: "twenty-sixth", 27: "twenty-seventh", 28: "twenty-eighth", 29: "twenty-ninth", 30: "thirtieth", 31: "thirty-first"}


def number_words(value: int) -> str:
    if value < 20:
        return ONES[value]
    if value < 100:
        return TENS[value // 10] + (f"-{ONES[value % 10]}" if value % 10 else "")
    if value < 1000:
        rest = value % 100
        return f"{ONES[value // 100]} hundred" + (f" and {number_words(rest)}" if rest else "")
    if value < 1_000_000:
        rest = value % 1000
        return f"{number_words(value // 1000)} thousand" + (f" {number_words(rest)}" if rest else "")
    return " ".join(ONES[int(digit)] for digit in str(value))


def _year_words(value: int) -> str:
    if 2000 <= value <= 2009:
        return "two thousand" + (f" and {number_words(value - 2000)}" if value > 2000 else "")
    if 2010 <= value <= 2099:
        return f"twenty {number_words(value - 2000)}"
    if 1000 <= value <= 1999:
        first, second = divmod(value, 100)
        return f"{number_words(first)} hundred" if second == 0 else f"{number_words(first)} {number_words(second)}"
    return number_words(value)


def _spell_characters(value: str) -> str:
    return " ".join(number_words(int(char)) if char.isdigit() else char.upper() for char in value if char.isalnum())


def _email(match: re.Match) -> str:
    value = match.group(0)
    local, domain = value.split("@", 1)
    spoken_local = local.replace(".", " dot ").replace("_", " underscore ").replace("-", " hyphen ")
    spoken_domain = domain.replace(".", " dot ").replace("-", " hyphen ")
    return f"{spoken_local} at {spoken_domain}"


def _money(match: re.Match) -> str:
    symbol, pounds, decimals = match.group(1), int(match.group(2).replace(",", "")), match.group(3)
    unit = "pound" if pounds == 1 else "pounds"
    result = f"{number_words(pounds)} {unit}"
    if decimals and int(decimals):
        result += f" {number_words(int(decimals))}"
    return result if symbol == "£" else result.replace("pound", "dollar")


def _time(match: re.Match) -> str:
    hour, minute = int(match.group(1)), int(match.group(2))
    return f"{number_words(hour)} {number_words(minute)}" if minute else f"{number_words(hour)} o'clock"


def _phone(match: re.Match) -> str:
    groups = re.findall(r"\d+", match.group(0))
    return ", ".join(" ".join(ONES[int(digit)] for digit in group) for group in groups)


def _postcode(match: re.Match) -> str:
    return f"{_spell_characters(match.group(1))}, {_spell_characters(match.group(2))}"


def normalize_speech_text(text: str) -> str:
    result = text
    result = re.sub(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", _email, result, flags=re.IGNORECASE)
    result = re.sub(r"([£$])(\d[\d,]*)(?:\.(\d{2}))?", _money, result)
    result = re.sub(r"\b(\d{1,2}):(\d{2})\b", _time, result)
    result = re.sub(r"\b(\d{1,2})(?:st|nd|rd|th)\s+([A-Z][a-z]+)\b", lambda m: f"the {ORDINALS.get(int(m.group(1)), number_words(int(m.group(1))))} of {m.group(2)}", result)
    result = re.sub(r"\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b", _postcode, result)
    result = re.sub(r"\b(?:\+?\d[\d ()-]{7,}\d)\b", _phone, result)
    result = re.sub(r"\b(1\d{3}|20\d{2})\b", lambda m: _year_words(int(m.group(0))), result)
    result = re.sub(r"\b\d+\b", lambda m: number_words(int(m.group(0))), result)
    result = re.sub(r"\b(?:UK|USA|BBC|IELTS|NHS|ID)\b", lambda m: " ".join(m.group(0)), result)
    return re.sub(r"[ \t]+", " ", result).strip()

import os


def _price(name: str, default: float) -> float:
    return float(os.getenv(name, str(default)))


INPUT_PRICE_PER_M = _price("OPENAI_INPUT_PRICE_PER_M", 2.50)
CACHED_INPUT_PRICE_PER_M = _price("OPENAI_CACHED_INPUT_PRICE_PER_M", 0.25)
OUTPUT_PRICE_PER_M = _price("OPENAI_OUTPUT_PRICE_PER_M", 15.00)


def calculate_cost(
    input_tokens: int,
    output_tokens: int,
    cached_input_tokens: int = 0,
) -> float:
    cached_input_tokens = min(max(cached_input_tokens, 0), input_tokens)
    uncached_input_tokens = input_tokens - cached_input_tokens
    return (
        uncached_input_tokens * INPUT_PRICE_PER_M
        + cached_input_tokens * CACHED_INPUT_PRICE_PER_M
        + output_tokens * OUTPUT_PRICE_PER_M
    ) / 1_000_000


def estimate_production_costs(users_count: int = 10_000) -> None:
    scenarios = (
        ("MODERADO", 5, 1_000, 150),
        ("INTENSIVO", 15, 2_500, 300),
    )

    print(f"--- ESTIMACIÓN DE COSTOS CHATBOT ({users_count} usuarios) ---")
    print(f"Precio input: ${INPUT_PRICE_PER_M}/1M tokens")
    print(f"Precio cached input: ${CACHED_INPUT_PRICE_PER_M}/1M tokens")
    print(f"Precio output: ${OUTPUT_PRICE_PER_M}/1M tokens")

    totals = []
    for name, messages_per_user, input_tokens, output_tokens in scenarios:
        cost_per_message = calculate_cost(input_tokens, output_tokens)
        monthly_total = cost_per_message * messages_per_user * users_count
        totals.append(monthly_total)
        print("-" * 50)
        print(f"ESCENARIO {name}")
        print(f"  Costo por mensaje: ${cost_per_message:.6f}")
        print(f"  Total mensual: ${monthly_total:.2f}")

    print("-" * 50)
    print(f"PROMEDIO ESTIMADO: ${sum(totals) / len(totals):.2f} USD / mes")


if __name__ == "__main__":
    estimate_production_costs()

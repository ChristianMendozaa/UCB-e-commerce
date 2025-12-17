import math

# Precios por Millón de tokens (según agent_service.py)
INPUT_PRICE_PER_M = 0.15  # USD
OUTPUT_PRICE_PER_M = 0.60 # USD

def calculate_cost(input_tokens, output_tokens):
    cost_input = (input_tokens / 1_000_000) * INPUT_PRICE_PER_M
    cost_output = (output_tokens / 1_000_000) * OUTPUT_PRICE_PER_M
    return cost_input + cost_output

def estimate_production_costs(users_count=10000):
    print(f"--- ESTIMACIÓN DE COSTOS CHATBOT ({users_count} Usuarios) ---")
    print(f"Precio Input: ${INPUT_PRICE_PER_M}/1M tokens")
    print(f"Precio Output: ${OUTPUT_PRICE_PER_M}/1M tokens")
    print("-" * 50)

    # Escenario 1: Uso Moderado
    # - 5 mensajes por usuario al mes
    # - Input promedio: 1000 tokens (Prompt + Historial + RAG Context)
    # - Output promedio: 150 tokens
    msgs_per_user_mod = 5
    avg_input_mod = 1000
    avg_output_mod = 150
    
    cost_per_msg_mod = calculate_cost(avg_input_mod, avg_output_mod)
    total_cost_mod = cost_per_msg_mod * msgs_per_user_mod * users_count
    
    print(f"ESCENARIO MODERADO (5 msgs/usuario, ~1k tokens entrada):")
    print(f"  Costo por mensaje: ${cost_per_msg_mod:.6f}")
    print(f"  Costo por usuario (mensual): ${cost_per_msg_mod * msgs_per_user_mod:.4f}")
    print(f"  TOTAL MENSUAL ({users_count} usuarios): ${total_cost_mod:.2f}")
    print("-" * 50)

    # Escenario 2: Uso Intensivo (Power Users / Sesiones largas)
    # - 15 mensajes por usuario al mes
    # - Input promedio: 2500 tokens (Historiales largos, RAG denso)
    # - Output promedio: 300 tokens
    msgs_per_user_high = 15
    avg_input_high = 2500
    avg_output_high = 300
    
    cost_per_msg_high = calculate_cost(avg_input_high, avg_output_high)
    total_cost_high = cost_per_msg_high * msgs_per_user_high * users_count

    print(f"ESCENARIO INTENSIVO (15 msgs/usuario, ~2.5k tokens entrada):")
    print(f"  Costo por mensaje: ${cost_per_msg_high:.6f}")
    print(f"  Costo por usuario (mensual): ${cost_per_msg_high * msgs_per_user_high:.4f}")
    print(f"  TOTAL MENSUAL ({users_count} usuarios): ${total_cost_high:.2f}")
    print("-" * 50)

    # Promedio General
    avg_total = (total_cost_mod + total_cost_high) / 2
    print(f"PROMEDIO ESTIMADO: ${avg_total:.2f} USD / mes")

if __name__ == "__main__":
    estimate_production_costs(10000)

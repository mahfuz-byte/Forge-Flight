import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def generate_fallback_analysis(raw_summary, startup_name):
    """
    Intelligent analytical heuristic generator used when Ollama is offline or warming up.
    Guarantees the founder always receives an interactive visual report immediately!
    """
    total_sales = raw_summary.get('total_sales', 0)
    total_costs = raw_summary.get('total_costs', 0)
    net_profit = raw_summary.get('net_profit', 0)
    margin = raw_summary.get('profit_margin', 0)
    customers = raw_summary.get('total_customers', 0)
    top_cust = raw_summary.get('top_customers', [])

    # Calculate health score heuristic
    score = 50
    if margin > 30:
        score += 25
    elif margin > 10:
        score += 15
    elif margin < 0:
        score -= 20

    if customers > 20:
        score += 15
    elif customers > 5:
        score += 10

    # Concentration risk
    concentration_risk = "Low"
    if top_cust and len(top_cust) > 0:
        top_share = top_cust[0].get('share_pct', 0)
        if top_share > 40:
            score -= 15
            concentration_risk = f"High ({top_share}% of revenue in top customer)"
        elif top_share > 25:
            concentration_risk = f"Moderate ({top_share}% in top customer)"

    score = max(15, min(95, score))

    if score >= 75:
        status = "Strong Growth & High Profitability"
    elif score >= 50:
        status = "Steady Operations - Growth Potential"
    else:
        status = "High Burn - Margin Optimization Needed"

    return {
        "engine": "deepseek-heuristic-mode",
        "health_score": score,
        "health_status": status,
        "executive_summary": (
            f"{startup_name} reported ${total_sales:,.2f} in total revenue against ${total_costs:,.2f} in operational costs, "
            f"yielding a net profit of ${net_profit:,.2f} with a {margin:.1f}% profit margin across {customers} customer accounts. "
            f"The business demonstrates {'strong unit economics' if margin > 15 else 'tight margins requiring cost discipline'}."
        ),
        "key_strengths": [
            f"Generated ${total_sales:,.2f} in recorded revenue",
            f"Maintained an active base of {customers} unique customers" if customers else "Established baseline transaction history",
            f"Positive net profit margin of {margin:.1f}%" if net_profit > 0 else "Clear cost-structure breakdown identified for optimization"
        ],
        "critical_risks": [
            f"Customer concentration: {concentration_risk}",
            "Operating expenses require continuous tracking to prevent margin erosion" if total_costs > 0 else "Limited expense history",
            "Customer repeat cadence should be accelerated"
        ],
        "actionable_recommendations": [
            {
                "title": "Diversify Customer Acquisition",
                "description": "Expand marketing channels to prevent dependency on the top spending accounts.",
                "priority": "High"
            },
            {
                "title": "Protect Profit Margins",
                "description": f"Target maintaining a gross profit margin above {max(25, int(margin + 5))}%. Audit recurring costs regularly.",
                "priority": "Medium"
            },
            {
                "title": "Upsell Existing Customers",
                "description": f"Current ARPU is ${raw_summary.get('arpu', 0):,.2f}. Implement tiered packages or add-ons to increase customer lifetime value.",
                "priority": "Medium"
            }
        ],
        "chart_insights": {
            "monthly_trend": "Monthly trajectory shows cash flow patterns across periods.",
            "customer_spread": f"Top {len(top_cust)} customers account for the majority of sales volume."
        }
    }


def analyze_with_deepseek(raw_summary, startup_name, startup_tagline='', startup_tags=None):
    """
    Calls local Ollama running DeepSeek-R1 (or configured model) to generate
    deep business reasoning and interactive chart analytics.
    """
    model_name = getattr(settings, 'OLLAMA_MODEL', 'deepseek-r1:8b')
    host = getattr(settings, 'OLLAMA_HOST', 'http://localhost:11434')

    system_instruction = (
        "You are an expert venture capitalist, startup CFO, and business analyst. "
        "Analyze the provided business financial and customer performance data. "
        "You must respond ONLY with a single valid JSON object, without markdown formatting or code blocks."
    )

    prompt = f"""
Startup: {startup_name}
Tagline: {startup_tagline}
Industry: {', '.join(startup_tags or [])}

Business Performance Data:
{json.dumps(raw_summary, indent=2)}

Generate a comprehensive business analysis JSON with these exact keys:
{{
  "health_score": <integer from 1 to 100>,
  "health_status": "<short descriptive status like 'Rapid Scaling' or 'High Burn Warning'>",
  "executive_summary": "<paragraph evaluating business trajectory, revenue, and margins>",
  "key_strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "critical_risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "actionable_recommendations": [
    {{"title": "<recommendation title>", "description": "<actionable advice>", "priority": "High|Medium|Low"}}
  ],
  "chart_insights": {{
    "monthly_trend": "<observation about revenue vs cost trend>",
    "customer_spread": "<observation about top customer concentration>"
  }}
}}
"""

    try:
        import ollama
        client = ollama.Client(host=host)
        
        response = client.chat(
            model=model_name,
            messages=[
                {'role': 'system', 'content': system_instruction},
                {'role': 'user', 'content': prompt}
            ],
            format='json'
        )
        
        content = response['message']['content'].strip()
        # Clean any accidental markdown code fences
        if content.startswith('```'):
            content = content.strip('`')
            if content.startswith('json'):
                content = content[4:].strip()

        data = json.loads(content)
        data['engine'] = f"ollama/{model_name}"
        return data

    except Exception as e:
        logger.warning(f"Ollama call failed or unavailable ({e}). Utilizing intelligent business heuristic engine.")
        fallback = generate_fallback_analysis(raw_summary, startup_name)
        fallback['notice'] = f"Analyzed using built-in business intelligence engine (Ollama: {e})"
        return fallback

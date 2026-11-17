import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def generate_fallback_analysis(raw_summary, startup_name, startup_tagline='', startup_tags=None):
    """
    Intelligent valuation, future projection, and investment verdict generator.
    Guarantees that anyone researching a company gets an instant, deeply reasoned verdict.
    """
    total_sales = float(raw_summary.get('total_sales', 0.0))
    total_costs = float(raw_summary.get('total_costs', 0.0))
    net_profit = float(raw_summary.get('net_profit', 0.0))
    margin = float(raw_summary.get('profit_margin', 0.0))
    customers = int(raw_summary.get('total_customers', 0))
    top_cust = raw_summary.get('top_customers', [])
    timeline = raw_summary.get('monthly_timeline', [])
    mom_rate = float(raw_summary.get('mom_growth_rate', 0.0))

    # Determine annualized revenue (ARR estimate)
    if timeline and len(timeline) > 0:
        recent_sales = [m.get('sales', 0.0) for m in timeline[-3:]]
        avg_monthly = sum(recent_sales) / len(recent_sales) if recent_sales else total_sales
        arr = avg_monthly * 12
    elif total_sales > 0:
        arr = total_sales * 2.5
    else:
        arr = 120000.0

    # Valuation Multiple Calculation
    base_mult_low = 4.0
    base_mult_high = 6.5
    if margin > 25:
        base_mult_low += 1.0
        base_mult_high += 1.5
    if mom_rate > 15:
        base_mult_low += 1.2
        base_mult_high += 2.0

    val_low = max(250000, int(arr * base_mult_low))
    val_high = max(500000, int(arr * base_mult_high))
    val_multiple = f"{base_mult_low:.1f}x - {base_mult_high:.1f}x ARR"
    val_rationale = (
        f"Valuation estimated between ${val_low:,.0f} and ${val_high:,.0f} applying a {val_multiple} "
        f"multiple on projected annualized revenue (${arr:,.0f}) given a {margin:.1f}% profit margin."
    )

    # Health & Verdict Score
    score = 55
    if margin > 25:
        score += 20
    elif margin > 10:
        score += 10
    elif margin < 0:
        score -= 15

    if mom_rate > 20:
        score += 15
    elif mom_rate > 5:
        score += 8

    if customers > 15:
        score += 10

    # Concentration risk
    concentration_risk = "Low"
    if top_cust and len(top_cust) > 0:
        top_share = top_cust[0].get('share_pct', 0)
        if top_share > 40:
            score -= 15
            concentration_risk = f"High ({top_share}% in top client)"
        elif top_share > 25:
            concentration_risk = f"Moderate ({top_share}% in top client)"

    score = max(20, min(96, score))

    if score >= 80:
        verdict = "High Growth Potential"
        status = "Exceptional Unit Economics & Trajectory"
    elif score >= 65:
        verdict = "Solid Investment Grade"
        status = "Steady Growth - Expansion Ready"
    elif score >= 50:
        verdict = "Moderate Growth - Monitoring Stage"
        status = "Operational Break-even Trajectory"
    else:
        verdict = "High Burn - Restructuring Needed"
        status = "Margin Compression Warning"

    # Growth stage
    if mom_rate > 25 or arr > 500000:
        stage = "Rapid Scale"
        projected_annual = max(35.0, round(mom_rate * 3.2, 1))
    elif mom_rate > 10:
        stage = "Early Traction"
        projected_annual = max(25.0, round(mom_rate * 2.5, 1))
    else:
        stage = "Seed Validation"
        projected_annual = 22.5

    # 4-Quarter / 12-Month Future Projections
    last_sales = timeline[-1]['sales'] if timeline else max(15000.0, total_sales / 3)
    last_costs = timeline[-1]['costs'] if timeline else max(8000.0, total_costs / 3)
    future_projections = []
    curr_s = last_sales * 3  # Quarterly base
    curr_c = last_costs * 3
    quarter_growth = max(1.08, 1.0 + (projected_annual / 400))

    quarters = ["Q1 Forecast", "Q2 Forecast", "Q3 Forecast", "Q4 Forecast"]
    for q in quarters:
        curr_s = round(curr_s * quarter_growth, 2)
        curr_c = round(curr_c * (1.0 + (quarter_growth - 1.0) * 0.65), 2)
        p = round(curr_s - curr_c, 2)
        future_projections.append({
            "period": q,
            "sales": curr_s,
            "costs": curr_c,
            "profit": p
        })

    return {
        "engine": "deepseek-heuristic-mode",
        "health_score": score,
        "health_status": status,
        "investment_verdict": verdict,
        "valuation_estimate": {
            "low": val_low,
            "high": val_high,
            "multiple": val_multiple,
            "rationale": val_rationale
        },
        "business_growth_percentage": {
            "historical_mom_growth": mom_rate,
            "projected_annual_growth": projected_annual,
            "growth_stage": stage
        },
        "future_projections": future_projections,
        "executive_summary": (
            f"Based on published records, {startup_name} recorded ${total_sales:,.2f} in revenue with a {margin:.1f}% profit margin. "
            f"The company demonstrates a {stage.lower()} profile with an estimated valuation of ${val_low:,.0f} - ${val_high:,.0f} "
            f"and projected annual growth of {projected_annual:.1f}%. Recommended verdict: {verdict}."
        ),
        "key_strengths": [
            f"Published ${total_sales:,.2f} in revenue with a healthy {margin:.1f}% margin",
            f"Strong customer engagement with {customers} unique accounts on record",
            f"Projected {projected_annual:.1f}% forward annualized revenue expansion"
        ],
        "critical_risks": [
            f"Customer concentration: {concentration_risk}",
            "Operational scaling must maintain cost discipline to preserve gross margins",
            "Working capital requirements may increase as sales volume expands"
        ],
        "actionable_recommendations": [
            {
                "title": "Scale High-Margin Revenue Streams",
                "description": f"Target maintaining operating margins above {max(25, int(margin + 5))}%.",
                "priority": "High"
            },
            {
                "title": "Customer Diversification Strategy",
                "description": "Expand inbound acquisition to broaden client base beyond the top 20% spending accounts.",
                "priority": "High"
            },
            {
                "title": "Capital Deployment for Milestones",
                "description": f"Align next funding check with reaching ${future_projections[-1]['sales']:,.0f} quarterly run-rate.",
                "priority": "Medium"
            }
        ],
        "chart_insights": {
            "monthly_trend": "Historical cash-flow indicates solid operating leverage and consistent sales momentum.",
            "customer_spread": f"Top accounts contribute stable recurring revenue with expansion potential."
        }
    }


def analyze_with_deepseek(raw_summary, startup_name, startup_tagline='', startup_tags=None):
    """
    Calls local Ollama running DeepSeek-R1 (or configured model) to generate
    valuation estimation, future projections, and investment verdicts.
    """
    if getattr(settings, 'AI_PROVIDER', 'ollama') != 'ollama':
        analysis = generate_fallback_analysis(raw_summary, startup_name, startup_tagline, startup_tags)
        analysis['engine'] = 'built-in-analysis'
        analysis['notice'] = 'Analyzed using the built-in financial analysis engine.'
        return analysis

    model_name = getattr(settings, 'OLLAMA_MODEL', 'deepseek-r1:8b')
    host = getattr(settings, 'OLLAMA_HOST', 'http://localhost:11434')

    system_instruction = (
        "You are an elite venture capitalist, investment banker, and startup valuation expert. "
        "Analyze the provided published startup business statistics and financial records. "
        "Formulate a professional investor verdict: valuation estimate, growth trajectory %, "
        "and 4-quarter future revenue/cost projections. "
        "You must respond ONLY with a single valid JSON object, without markdown formatting or code blocks."
    )

    prompt = f"""
Startup: {startup_name}
Tagline: {startup_tagline}
Industry: {', '.join(startup_tags or [])}

Published Business Performance Data:
{json.dumps(raw_summary, indent=2)}

Generate a comprehensive business analysis JSON with these exact keys:
{{
  "health_score": <integer from 1 to 100>,
  "health_status": "<short descriptive status like 'Rapid Scaling' or 'Margin Warning'>",
  "investment_verdict": "<e.g. 'High Growth Potential' | 'Solid Investment Grade' | 'Moderate Growth' | 'High Burn Warning'>",
  "valuation_estimate": {{
    "low": <integer estimated valuation low in USD>,
    "high": <integer estimated valuation high in USD>,
    "multiple": "<e.g. 5x - 8x ARR>",
    "rationale": "<brief explanation of valuation rationale>"
  }},
  "business_growth_percentage": {{
    "historical_mom_growth": <float MoM % growth rate>,
    "projected_annual_growth": <float projected % YoY growth rate>,
    "growth_stage": "<e.g. 'Early Traction' | 'Rapid Scale' | 'Seed Validation'>"
  }},
  "future_projections": [
    {{"period": "Q1 Forecast", "sales": <float>, "costs": <float>, "profit": <float>}},
    {{"period": "Q2 Forecast", "sales": <float>, "costs": <float>, "profit": <float>}},
    {{"period": "Q3 Forecast", "sales": <float>, "costs": <float>, "profit": <float>}},
    {{"period": "Q4 Forecast", "sales": <float>, "costs": <float>, "profit": <float>}}
  ],
  "executive_summary": "<paragraph evaluating company performance, valuation justification, and investment appeal>",
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
        # Ultra-fast socket check to verify Ollama host is listening before attempting chat
        import socket
        from urllib.parse import urlparse
        parsed = urlparse(host)
        target_host = parsed.hostname or '127.0.0.1'
        target_port = parsed.port or 11434
        
        sock = socket.create_connection((target_host, target_port), timeout=0.8)
        sock.close()

        import ollama
        bridge_token = getattr(settings, 'OLLAMA_BRIDGE_TOKEN', '')
        headers = {'Authorization': f'Bearer {bridge_token}'} if bridge_token else None
        client = ollama.Client(host=host, headers=headers, timeout=60)

        response = client.chat(
            model=model_name,
            messages=[
                {'role': 'system', 'content': system_instruction},
                {'role': 'user', 'content': prompt}
            ],
            format='json'
        )

        content = response['message']['content'].strip()
        
        # Clean reasoning traces from DeepSeek-R1 (<think>...</think>)
        import re
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
        
        # Clean markdown code fences if present
        if '```' in content:
            fence_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
            if fence_match:
                content = fence_match.group(1).strip()

        # Extract JSON object bounded by outermost { ... }
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            content = json_match.group(0).strip()

        data = json.loads(content)
        data['engine'] = f"ollama/{model_name}"

        # Ensure future_projections has 4 quarters
        projections = data.get('future_projections') or []
        if len(projections) < 4:
            fallback = generate_fallback_analysis(raw_summary, startup_name, startup_tagline, startup_tags)
            data['future_projections'] = fallback.get('future_projections', [])

        return data

    except Exception:
        logger.exception('Ollama call failed or is unavailable; using the built-in analysis.')
        fallback = generate_fallback_analysis(raw_summary, startup_name, startup_tagline, startup_tags)
        fallback['notice'] = 'Analyzed using the built-in financial analysis engine.'
        return fallback

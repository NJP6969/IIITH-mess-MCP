// Extra items tools

import { client } from "../client.js";
import type { ApiResponse, ExtraItem, ExtraRegistration, Meal } from "../types.js";

export async function getExtras(meal: Meal, date?: string): Promise<string> {
  const params: Record<string, string> = { meal };
  if (date) params.date = date;

  const response = await client.get<ApiResponse<ExtraItem[]>>("/extras", params);
  
  const extras = response.data;
  if (!extras || extras.length === 0) {
    return `No extra items available for ${meal}${date ? ` on ${date}` : ""}.`;
  }

  const lines: string[] = [];
  lines.push(`## Extra Items for ${meal.charAt(0).toUpperCase() + meal.slice(1)}\n`);

  // Group by mess
  const byMess: Record<string, ExtraItem[]> = {};
  for (const extra of extras) {
    if (!byMess[extra.mess]) {
      byMess[extra.mess] = [];
    }
    byMess[extra.mess].push(extra);
  }

  for (const [mess, items] of Object.entries(byMess)) {
    lines.push(`### ${mess}`);
    for (const item of items) {
      const priceRupees = (item.rate / 100).toFixed(2);
      const vegTag = item.food_tags ? "🔴 Non-Veg" : "🟢 Veg";
      lines.push(`  • **${item.name}** - ₹${priceRupees} ${vegTag}`);
      if (item.description) {
        lines.push(`    ${item.description}`);
      }
      lines.push(`    ID: ${item.id}`);
    }
    lines.push("");
  }

  // Extras, prices and IDs can differ by date and mess, so IDs should be looked up per date
  lines.push(
    "_To register, pass the item ID as `extra_id` and the mess heading as `meal_mess` to register_extra. " +
    "Availability and IDs can differ by date and mess, so look them up for the exact date._"
  );

  return lines.join("\n");
}

export async function getExtraRegistrations(meal: Meal, date?: string): Promise<string> {
  const params: Record<string, string> = { meal };
  if (date) params.date = date;

  const response = await client.get<ApiResponse<ExtraRegistration[]>>("/registrations/extras", params);
  
  const extras = response.data;
  if (!extras || extras.length === 0) {
    return `No extra items registered for ${meal}${date ? ` on ${date}` : ""}.`;
  }

  const lines: string[] = [];
  lines.push(`## Your Extra Registrations for ${meal.charAt(0).toUpperCase() + meal.slice(1)}\n`);

  for (const extra of extras) {
    const priceRupees = (parseFloat(extra.extra_rate) / 100).toFixed(2);
    let status = "✅ Registered";
    if (extra.availed_at) status = "🍽️ Availed";
    
    lines.push(`• **${extra.extra_name}** at ${extra.meal_mess} - ₹${priceRupees} ${status}`);
    lines.push(`  ID: ${extra.id} (for deletion)`);
  }

  return lines.join("\n");
}

export async function registerExtra(
  extraId: string,
  mealDate: string,
  mealType: Meal,
  mealMess: string
): Promise<string> {
  const response = await client.post<ApiResponse<ExtraRegistration[]>>("/registrations/extras", {
    extra: extraId,
    meal_date: mealDate,
    meal_type: mealType,
    meal_mess: mealMess,
  });

  const lines = [`✅ Successfully registered for extra item on ${mealDate} for ${mealType}.`];

  // Surface the new registration ID(s) when the API returns them, so they can be deleted later
  const registrations = Array.isArray(response?.data) ? response.data : [];
  for (const registration of registrations) {
    if (registration?.id) {
      lines.push(`  ID: ${registration.id} (for deletion)`);
    }
  }

  return lines.join("\n");
}

export async function deleteExtraRegistration(registrationId: string): Promise<string> {
  await client.delete("/registrations/extras", { id: registrationId });

  return `✅ Deleted extra registration ${registrationId}.`;
}

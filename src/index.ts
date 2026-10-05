#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import tool functions
import { getUserInfo, resetQRToken } from "./tools/auth.js";
import { getMessInfo, getMenu, getMealRates, getMealCapacities, getMealTimings } from "./tools/mess.js";
import { getRegistrations, getRegistration, registerMeal, cancelMeal, uncancelMeal, skipMeal, getCancellationCount } from "./tools/registrations.js";
import { getBill, submitFeedback, getMealRating } from "./tools/billing.js";
import { getExtras, getExtraRegistrations, registerExtra, deleteExtraRegistration } from "./tools/extras.js";
import { getMonthlyRegistration, createMonthlyRegistration, deleteMonthlyRegistration } from "./tools/monthly.js";
import { getPreferences, updatePreferences, getRegistrationWindow, getCancellationWindow, getMaxCancellations, getRegistrationMaxDate } from "./tools/config.js";

import type { Meal, UserPreferences } from "./types.js";

// Create the MCP server
const server = new Server(
  {
    name: "mess-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Helper to get today's date
function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

// Helper to get date range for current week
function getWeekRange(): { from: string; to: string } {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    from: monday.toISOString().split("T")[0],
    to: sunday.toISOString().split("T")[0],
  };
}

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Auth tools
      {
        name: "get_user_info",
        description: "Get your profile information including name, email, roll number, and last login",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "reset_qr_token",
        description: "Reset your QR code token used for meal verification at the mess",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      // Mess info tools
      {
        name: "get_mess_info",
        description: "List all available messes with their status (open/closed)",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "get_menu",
        description: "Get the menu for all messes on a specific date",
        inputSchema: {
          type: "object",
          properties: {
            date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
          },
          required: [],
        },
      },
      {
        name: "get_meal_rates",
        description: "Get meal rates for all messes",
        inputSchema: {
          type: "object",
          properties: {
            meal: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
            date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
          },
          required: ["meal"],
        },
      },
      {
        name: "get_meal_capacities",
        description: "Get available capacity at each mess for a meal",
        inputSchema: {
          type: "object",
          properties: {
            meal: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
            date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
          },
          required: ["meal"],
        },
      },
      {
        name: "get_meal_timings",
        description: "Get meal serving times at each mess",
        inputSchema: {
          type: "object",
          properties: {
            date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
          },
          required: [],
        },
      },
      // Registration tools
      {
        name: "get_registrations",
        description: "Get all your meal registrations in a date range (max 2 months)",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Start date in YYYY-MM-DD format" },
            to: { type: "string", description: "End date in YYYY-MM-DD format" },
          },
          required: ["from", "to"],
        },
      },
      {
        name: "get_registration",
        description: "Get your registration for a specific meal on a date",
        inputSchema: {
          type: "object",
          properties: {
            meal: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
            date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
          },
          required: [],
        },
      },
      {
        name: "register_meal",
        description: "Register for a meal at a specific mess",
        inputSchema: {
          type: "object",
          properties: {
            meal_date: { type: "string", description: "Date in YYYY-MM-DD format" },
            meal_type: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
            meal_mess: { type: "string", description: "Mess ID (e.g., yuktahar, kadamba-veg, kadamba-nonveg)" },
            guests: { type: "number", description: "Number of guests (optional)" },
          },
          required: ["meal_date", "meal_type", "meal_mess"],
        },
      },
      {
        name: "cancel_meal",
        description: "Cancel a meal registration",
        inputSchema: {
          type: "object",
          properties: {
            meal_date: { type: "string", description: "Date in YYYY-MM-DD format" },
            meal_type: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
          },
          required: ["meal_date", "meal_type"],
        },
      },
      {
        name: "uncancel_meal",
        description: "Uncancel a previously cancelled meal registration",
        inputSchema: {
          type: "object",
          properties: {
            meal_date: { type: "string", description: "Date in YYYY-MM-DD format" },
            meal_type: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
          },
          required: ["meal_date", "meal_type"],
        },
      },
      {
        name: "skip_meal",
        description: "Mark a meal as skipped (you will still be charged)",
        inputSchema: {
          type: "object",
          properties: {
            meal_date: { type: "string", description: "Date in YYYY-MM-DD format" },
            meal_type: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
            meal_mess: { type: "string", description: "Mess ID" },
            skipping: { type: "boolean", description: "True to skip, false to unskip. Defaults to true." },
          },
          required: ["meal_date", "meal_type", "meal_mess"],
        },
      },
      {
        name: "get_cancellation_count",
        description: "Get how many cancellations you've used this month",
        inputSchema: {
          type: "object",
          properties: {
            meal: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
            month: { type: "number", description: "Month (1-12). Defaults to current month." },
            year: { type: "number", description: "Year. Defaults to current year." },
          },
          required: ["meal"],
        },
      },
      // Billing tools
      {
        name: "get_bill",
        description: "Get your mess bill for a month",
        inputSchema: {
          type: "object",
          properties: {
            month: { type: "number", description: "Month (1-12). Defaults to current month." },
            year: { type: "number", description: "Year. Defaults to current year." },
          },
          required: [],
        },
      },
      {
        name: "submit_feedback",
        description: "Submit anonymous feedback for a meal you've availed",
        inputSchema: {
          type: "object",
          properties: {
            meal_date: { type: "string", description: "Date in YYYY-MM-DD format" },
            meal_type: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
            rating: { type: "number", minimum: 1, maximum: 5, description: "Rating from 1-5" },
            remarks: { type: "string", description: "Optional feedback comments" },
          },
          required: ["meal_date", "meal_type", "rating"],
        },
      },
      {
        name: "get_meal_rating",
        description: "Get average ratings for a meal",
        inputSchema: {
          type: "object",
          properties: {
            meal: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
            date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
            mess: { type: "string", description: "Mess ID. If omitted, returns ratings for all messes." },
          },
          required: ["meal"],
        },
      },
      // Extra items tools
      {
        name: "get_extras",
        description: "List available extra items for a meal on a date, grouped by mess, including each item's ID. Availability, prices and IDs can vary by date and mess.",
        inputSchema: {
          type: "object",
          properties: {
            meal: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
            date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
          },
          required: ["meal"],
        },
      },
      {
        name: "get_extra_registrations",
        description: "Get your registered extra items",
        inputSchema: {
          type: "object",
          properties: {
            meal: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
            date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
          },
          required: ["meal"],
        },
      },
      {
        name: "register_extra",
        description: "Register for an extra item",
        inputSchema: {
          type: "object",
          properties: {
            extra_id: { type: "string", description: "ID of the extra item, from get_extras for the same date and meal" },
            meal_date: { type: "string", description: "Date in YYYY-MM-DD format" },
            meal_type: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
            meal_mess: { type: "string", description: "Mess ID (e.g. kadamba-nonveg), which must offer this extra on that date" },
          },
          required: ["extra_id", "meal_date", "meal_type", "meal_mess"],
        },
      },
      {
        name: "delete_extra_registration",
        description: "Delete an extra item registration",
        inputSchema: {
          type: "object",
          properties: {
            registration_id: { type: "string", description: "ID of the extra registration to delete" },
          },
          required: ["registration_id"],
        },
      },
      // Monthly registration tools
      {
        name: "get_monthly_registration",
        description: "Get your monthly registration for a mess",
        inputSchema: {
          type: "object",
          properties: {
            month: { type: "number", description: "Month (1-12). Defaults to current month." },
            year: { type: "number", description: "Year. Defaults to current year." },
          },
          required: [],
        },
      },
      {
        name: "create_monthly_registration",
        description: "Register at a mess for an entire month",
        inputSchema: {
          type: "object",
          properties: {
            month: { type: "number", description: "Month (1-12)" },
            year: { type: "number", description: "Year" },
            mess: { type: "string", description: "Mess ID" },
          },
          required: ["month", "year", "mess"],
        },
      },
      {
        name: "delete_monthly_registration",
        description: "Delete a monthly registration",
        inputSchema: {
          type: "object",
          properties: {
            month: { type: "number", description: "Month (1-12)" },
            year: { type: "number", description: "Year" },
          },
          required: ["month", "year"],
        },
      },
      // Config tools
      {
        name: "get_preferences",
        description: "Get your notification and meal preferences",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "update_preferences",
        description: "Update your preferences",
        inputSchema: {
          type: "object",
          properties: {
            notify_not_registered: { type: "boolean", description: "Notify when not registered for a meal" },
            notify_malloc_happened: { type: "boolean", description: "Notify when randomly allocated to a meal" },
            auto_reset_token_daily: { type: "boolean", description: "Auto-reset QR token daily at 2 AM" },
            enable_unregistered: { type: "boolean", description: "Allow availing meals without registration" },
            nag_for_feedback: { type: "boolean", description: "Prompt for feedback after meals" },
          },
          required: [],
        },
      },
      {
        name: "get_registration_window",
        description: "Get how far in advance you can register for meals",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "get_cancellation_window",
        description: "Get how late you can cancel a meal",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "get_max_cancellations",
        description: "Get the maximum allowed cancellations per month for a meal",
        inputSchema: {
          type: "object",
          properties: {
            meal: { type: "string", enum: ["breakfast", "lunch", "snacks", "dinner"], description: "The meal type" },
          },
          required: ["meal"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      // Auth tools
      case "get_user_info":
        result = await getUserInfo();
        break;
      case "reset_qr_token":
        result = await resetQRToken();
        break;

      // Mess info tools
      case "get_mess_info":
        result = await getMessInfo();
        break;
      case "get_menu":
        result = await getMenu(args?.date as string | undefined);
        break;
      case "get_meal_rates":
        result = await getMealRates(args?.meal as string, args?.date as string | undefined);
        break;
      case "get_meal_capacities":
        result = await getMealCapacities(args?.meal as string, args?.date as string | undefined);
        break;
      case "get_meal_timings":
        result = await getMealTimings(args?.date as string | undefined);
        break;

      // Registration tools
      case "get_registrations":
        result = await getRegistrations(args?.from as string, args?.to as string);
        break;
      case "get_registration":
        result = await getRegistration(args?.meal as string | undefined, args?.date as string | undefined);
        break;
      case "register_meal":
        result = await registerMeal(
          args?.meal_date as string,
          args?.meal_type as Meal,
          args?.meal_mess as string,
          args?.guests as number | undefined
        );
        break;
      case "cancel_meal":
        result = await cancelMeal(args?.meal_date as string, args?.meal_type as Meal);
        break;
      case "uncancel_meal":
        result = await uncancelMeal(args?.meal_date as string, args?.meal_type as Meal);
        break;
      case "skip_meal":
        result = await skipMeal(
          args?.meal_date as string,
          args?.meal_type as Meal,
          args?.meal_mess as string,
          args?.skipping as boolean | undefined
        );
        break;
      case "get_cancellation_count":
        result = await getCancellationCount(
          args?.meal as Meal,
          args?.month as number | undefined,
          args?.year as number | undefined
        );
        break;

      // Billing tools
      case "get_bill":
        result = await getBill(args?.month as number | undefined, args?.year as number | undefined);
        break;
      case "submit_feedback":
        result = await submitFeedback(
          args?.meal_date as string,
          args?.meal_type as Meal,
          args?.rating as number,
          args?.remarks as string | undefined
        );
        break;
      case "get_meal_rating":
        result = await getMealRating(
          args?.meal as Meal,
          args?.date as string | undefined,
          args?.mess as string | undefined
        );
        break;

      // Extra items tools
      case "get_extras":
        result = await getExtras(args?.meal as Meal, args?.date as string | undefined);
        break;
      case "get_extra_registrations":
        result = await getExtraRegistrations(args?.meal as Meal, args?.date as string | undefined);
        break;
      case "register_extra":
        result = await registerExtra(
          args?.extra_id as string,
          args?.meal_date as string,
          args?.meal_type as Meal,
          args?.meal_mess as string
        );
        break;
      case "delete_extra_registration":
        result = await deleteExtraRegistration(args?.registration_id as string);
        break;

      // Monthly registration tools
      case "get_monthly_registration":
        result = await getMonthlyRegistration(
          args?.month as number | undefined,
          args?.year as number | undefined
        );
        break;
      case "create_monthly_registration":
        result = await createMonthlyRegistration(
          args?.month as number,
          args?.year as number,
          args?.mess as string
        );
        break;
      case "delete_monthly_registration":
        result = await deleteMonthlyRegistration(args?.month as number, args?.year as number);
        break;

      // Config tools
      case "get_preferences":
        result = await getPreferences();
        break;
      case "update_preferences":
        result = await updatePreferences(args as Partial<UserPreferences>);
        break;
      case "get_registration_window":
        result = await getRegistrationWindow();
        break;
      case "get_cancellation_window":
        result = await getCancellationWindow();
        break;
      case "get_max_cancellations":
        result = await getMaxCancellations(args?.meal as Meal);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: result }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [{ type: "text", text: `❌ Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Define resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "mess://user/profile",
        name: "User Profile",
        description: "Your mess portal profile information",
        mimeType: "text/plain",
      },
      {
        uri: "mess://registrations/today",
        name: "Today's Registrations",
        description: "Your meal registrations for today",
        mimeType: "text/plain",
      },
      {
        uri: "mess://registrations/week",
        name: "This Week's Registrations",
        description: "Your meal registrations for this week",
        mimeType: "text/plain",
      },
      {
        uri: "mess://menu/today",
        name: "Today's Menu",
        description: "Menu at all messes for today",
        mimeType: "text/plain",
      },
      {
        uri: "mess://bill/current",
        name: "Current Month's Bill",
        description: "Your mess bill for the current month",
        mimeType: "text/plain",
      },
    ],
  };
});

// Handle resource reads
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    let content: string;

    switch (uri) {
      case "mess://user/profile":
        content = await getUserInfo();
        break;
      case "mess://registrations/today":
        content = await getRegistration();
        break;
      case "mess://registrations/week": {
        const { from, to } = getWeekRange();
        content = await getRegistrations(from, to);
        break;
      }
      case "mess://menu/today":
        content = await getMenu();
        break;
      case "mess://bill/current":
        content = await getBill();
        break;
      default:
        throw new Error(`Unknown resource: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: content,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Failed to read resource ${uri}: ${errorMessage}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mess MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

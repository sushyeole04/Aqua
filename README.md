# Chhatrapati Aqua - Enterprise Water Delivery & SaaS Platform

**Chhatrapati Aqua** is a premium, mobile-first SaaS platform designed specifically for water jar suppliers. It integrates customer ordering pipelines, recurring subscription models, pre-booking slot schedulers, and pay-later credit wallets with a full-bleed administrative CRM, dispatch ops deck, inventory logs, and GST billing ledger.

---

## 🌊 Technical Stack

- **Frontend Core**: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Framer Motion (micro-animations), Lucide Icons.
- **Analytics & Charting**: Recharts (gradient areas, consumption bars).
- **Database ORM**: Prisma 7 (supporting PostgreSQL datasource models).
- **PDF Generation**: HTML-to-print compilation (CGST/SGST tax calculators).

---

## 🚀 Key Features

### 📱 1. Mobile-First Customer App
- **Quick Stepper**: Thumb-friendly buttons to order 1, 2, 3, or 5 jars, or numeric inputs for custom jar quantities.
- **Pre-Booking Slots**: Schedulers to reserve deliveries for future calendar dates and selected time slots (Morning, Noon, Afternoon, Evening).
- **Wallet & Pay Later**: Displays current balances, credit limits, outstanding dues, and a rolling ledger sheet tracking cash payments and credits.
- **Live SVG Path Tracking**: Map dashboard tracing delivery representatives moving along bezier curves from the Water Depot to the Customer's Flat in real time.
- **Loyalty & Referrals**: Referral code sharers (earn ₹50 credit) and reward counters (redeem 100 points for a FREE jar).
- **Multi-Language Controls**: Smooth language switcher toggling **English**, **Hindi**, and **Marathi** translations.

### 💻 2. Enterprise Admin Panel
- **Analytics Dashboards**: Interactive charts mapping weekly revenue growth and daily jar delivery volume, plus area-wise consumption gauges.
- **Operations Center**: Live orders stream allowing admins to accept requests, dispatch drivers, and record empty/damaged/lost jars.
- **Client CRM Profiles**: Ledger cards tracking account history logs.
- **Receivables & Alerts**: Reminders deck supporting simulated Twilio SMS and WhatsApp templates.
- **Billing Statements**: Compilation lists supporting tax invoice print-downloads.

---

## 📁 Directory Architecture

```
Aqua/
├── prisma/
│   └── schema.prisma        # Database entities (Users, Profile, Orders, Deliveries, Invoices)
├── prisma.config.ts         # Prisma 7 schema configuration mappings
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout, fonts, and meta SEO tags
│   │   ├── page.tsx         # Sandbox entry point linking AppStateProvider
│   │   └── globals.css      # Deep Aqua color tokens, glassmorphism cards, wave animations
│   ├── components/
│   │   ├── simulator-shell.tsx # Master Console wrapping Mobile View and Admin View
│   │   ├── customer-app/    # Customer modules (home, orders, wallet, history, profile, tracking)
│   │   └── admin-panel/     # Admin modules (dashboard, operations, CRM, payments, inventory, billing)
│   ├── context/
│   │   └── AppStateContext.tsx # Centralized simulation state engine
│   └── utils/
│       ├── dictionary.ts    # Multi-language translation dictionaries
│       └── pdf-generator.ts # GST tax invoice print utility
```

---

## ⚙️ Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server (Webpack Mode)
```bash
npm run dev
```
Open [http://localhost:3002](http://localhost:3002) in your browser. Use the top control bar to switch between Customer view, Admin view, or Split console side-by-side!

### 3. Production Compilation Build
```bash
npm run build
```

---

## 🗄️ Transitioning to PostgreSQL Database

The platform includes a client-side database simulation (backed by LocalStorage) so you can test all features (placing orders, dispatching drivers, payments, ledgers) without setting up databases. 

When you are ready to transition to your live cloud PostgreSQL database:

1. **Set Environment Variables**:  
   Add a `.env` file at the root containing your database link:
   ```env
   DATABASE_URL="postgresql://username:password@your-cloud-db-host:5432/chhatrapati_aqua?schema=public"
   ```

2. **Synchronize Database Schema**:  
   Run the Prisma DB Push command to create tables:
   ```bash
   npx prisma db push
   ```

3. **Bridge Server Actions**:  
   Replace local storage setters inside [AppStateContext.tsx](file:///c:/Users/Acer/OneDrive/Desktop/Aqua/src/context/AppStateContext.tsx) with Next.js Server Actions querying Prisma:
   ```typescript
   // Example Database Query
   import { PrismaClient } from "@prisma/client";
   const prisma = new PrismaClient();
   
   export async function getCustomerOrders(customerId: string) {
     return await prisma.order.findMany({
       where: { customerId },
       orderBy: { createdAt: 'desc' }
     });
   }
   ```

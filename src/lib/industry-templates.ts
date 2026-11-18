/**
 * Industry starter templates for the Sales & Revenue editors (delivery pages,
 * products, coupon campaigns). Pure data: picking one only pre-fills a form.
 */
import { DELIVERY_TEMPLATES, type DeliveryTemplate } from "@/lib/delivery-page";

export type IndustryKey =
  | "general" | "real_estate" | "nbfc" | "marketing_agency" | "education" | "healthcare"
  | "fitness" | "beauty" | "restaurant" | "ecommerce" | "travel" | "insurance" | "professional";

export type ProductPreset = { name: string; price: string; mrp: string; desc: string };
export type CouponPreset = { name: string; prefix: string; discount: string };
export type Industry = {
  key: IndustryKey; label: string;
  pages: DeliveryTemplate[]; products: ProductPreset[]; coupons: CouponPreset[];
};

type PageSpec = {
  key: string; name: string; hint: string; title: string; slug: string; button: string;
  intro: string; benefitsTitle: string; benefits: string[]; steps: string[];
  quote: string; faq: [string, string][]; mrp?: string; offer?: string;
};

function page(s: PageSpec): DeliveryTemplate {
  const body = [
    `# ${s.title}`, s.intro, "",
    `## ${s.benefitsTitle}`, ...s.benefits.map((b, i) => (i === 0 ? `- **${b}**` : `- ${b}`)), "",
    "## How it works", ...s.steps.map((x) => `- ${x}`), "",
    `> ${s.quote}`, "",
    "## Frequently asked questions", ...s.faq.map(([q, a]) => `? ${q} | ${a}`),
  ].join("\n");
  return {
    key: s.key, name: s.name, hint: s.hint, title: s.title, slug: s.slug, buttonLabel: s.button, body,
    ...(s.offer ? { priceOffer: s.offer, priceOriginal: s.mrp ?? "" } : {}),
  };
}

const GENERAL_COUPONS: CouponPreset[] = [
  { name: "Diwali sale", prefix: "DIWALI", discount: "20% off" },
  { name: "New Year sale", prefix: "NEWYEAR", discount: "15% off" },
  { name: "Launch week", prefix: "LAUNCH", discount: "25% off" },
  { name: "Followers special", prefix: "FOLLOW", discount: "10% off" },
];

export const INDUSTRIES: Industry[] = [
  {
    key: "general", label: "General / Creator", pages: DELIVERY_TEMPLATES, coupons: GENERAL_COUPONS,
    products: [
      { name: "E-book / PDF guide", price: "199", mrp: "499", desc: "Instant PDF download" },
      { name: "Online course", price: "999", mrp: "2999", desc: "Lifetime access to all lessons" },
      { name: "1:1 Consultation (30 min)", price: "1499", mrp: "2499", desc: "Personal video call" },
      { name: "Community access", price: "499", mrp: "999", desc: "Private group membership" },
    ],
  },
  {
    key: "real_estate", label: "Real Estate",
    pages: [
      page({ key: "re-brochure", name: "Project brochure", hint: "Free brochure + price list", title: "Download the project brochure & price list", slug: "project-brochure", button: "Get brochure",
        intro: "Floor plans, price list, amenities and location map — everything in one PDF.",
        benefitsTitle: "Inside the brochure", benefits: ["Latest price list & payment plans", "2/3 BHK floor plans with carpet area", "Amenities, RERA number and possession date", "Location advantages & nearby landmarks"],
        steps: ["Fill your name and phone", "Brochure opens instantly", "Our advisor calls only if you ask"],
        quote: "\"Clear pricing, no hidden charges — booked our site visit the same week.\" — Home buyer",
        faq: [["Is the project RERA registered?", "Yes, the RERA number is printed in the brochure."], ["Are home loans available?", "Yes, approved by leading banks. Ask our advisor for details."], ["Can I visit the site?", "Yes, tap the button and request a free site visit."]] }),
      page({ key: "re-sitevisit", name: "Site visit booking", hint: "Token / visit booking", title: "Book your free site visit", slug: "site-visit", button: "Book site visit",
        intro: "See the sample flat, amenities and neighbourhood with our property advisor. Free pick-up available.",
        benefitsTitle: "What you get", benefits: ["Free guided site visit", "Sample flat walkthrough", "On-spot booking offers", "Loan eligibility check"],
        steps: ["Choose your preferred date", "Get confirmation on WhatsApp", "Meet our advisor at site"],
        quote: "\"The advisor answered every question honestly.\" — Visitor",
        faq: [["Is the visit free?", "Yes, completely free with no obligation."], ["Can family join?", "Of course — bring everyone."]] }),
      page({ key: "re-token", name: "Booking token", hint: "Paid unit hold", title: "Reserve your unit with a booking token", slug: "booking-token", button: "Pay token amount", mrp: "51000", offer: "21000",
        intro: "Lock today's price and your preferred floor. Token adjusts against the final booking amount.",
        benefitsTitle: "Why book now", benefits: ["Today's price locked", "Preferred floor & facing", "Adjusted in final payment", "Refundable as per policy"],
        steps: ["Pay the token securely", "Receive receipt by email", "Our team completes paperwork"],
        quote: "\"Smooth booking, receipt in minutes.\" — Buyer",
        faq: [["Is the token refundable?", "As per the cancellation policy shown on this page."], ["Is this the full price?", "No, it is adjusted against your total booking amount."]] }),
    ],
    products: [
      { name: "Booking token amount", price: "21000", mrp: "51000", desc: "Adjusted against final booking" },
      { name: "Property consultation", price: "999", mrp: "1999", desc: "1-hour expert buying advice" },
      { name: "Legal document verification", price: "4999", mrp: "7999", desc: "Title & paperwork check" },
      { name: "Home loan assistance", price: "1999", mrp: "4999", desc: "End-to-end loan processing help" },
    ],
    coupons: [
      { name: "Festive booking offer", prefix: "FESTIVE", discount: "₹50,000 off" },
      { name: "Early bird launch", prefix: "EARLYBIRD", discount: "₹1 lakh off" },
      { name: "Site visit special", prefix: "VISIT", discount: "Free modular kitchen" },
      { name: "Zero stamp duty", prefix: "STAMP", discount: "Stamp duty waived" },
    ],
  },
  {
    key: "nbfc", label: "NBFC / Loans",
    pages: [
      page({ key: "nbfc-eligibility", name: "Loan eligibility check", hint: "Lead capture", title: "Check your loan eligibility in 2 minutes", slug: "loan-eligibility", button: "Check eligibility",
        intro: "Personal, business and gold loans with quick approval. No impact on your credit score to check.",
        benefitsTitle: "Why apply with us", benefits: ["Approval in as little as 24 hours", "Minimal documentation", "Transparent interest rates & fees", "RBI-registered NBFC"],
        steps: ["Share basic details", "Get an eligibility estimate", "Upload KYC and receive disbursal"],
        quote: "\"Got my business loan disbursed within 2 days.\" — Customer",
        faq: [["Does checking affect my CIBIL score?", "No, the eligibility check is a soft enquiry."], ["What documents are needed?", "PAN, Aadhaar, bank statements and income proof."], ["Are there hidden charges?", "No. All fees are shown in your sanction letter before you accept."]] }),
      page({ key: "nbfc-processing", name: "Processing fee payment", hint: "Paid application", title: "Complete your loan application", slug: "loan-processing", button: "Pay processing fee", mrp: "2999", offer: "999",
        intro: "Pay the one-time processing fee to start verification of your application.",
        benefitsTitle: "What's covered", benefits: ["Full document verification", "Credit assessment", "Dedicated relationship manager", "Sanction letter by email"],
        steps: ["Pay the fee securely", "Upload documents", "Receive your sanction decision"],
        quote: "\"Clear process and a helpful RM.\" — Borrower",
        faq: [["Is the fee refundable?", "Please read the refund policy on this page before paying."], ["Is approval guaranteed?", "No. Approval depends on credit assessment as per RBI guidelines."]] }),
    ],
    products: [
      { name: "Loan processing fee", price: "999", mrp: "2999", desc: "One-time application processing" },
      { name: "Credit score report & advice", price: "299", mrp: "799", desc: "Detailed report with improvement plan" },
      { name: "Business loan consultation", price: "1499", mrp: "2999", desc: "Expert guidance on funding options" },
    ],
    coupons: [
      { name: "Zero processing fee", prefix: "ZEROFEE", discount: "100% off processing fee" },
      { name: "Festive loan offer", prefix: "FESTLOAN", discount: "50% off processing fee" },
      { name: "Women entrepreneur", prefix: "SHE", discount: "₹500 off" },
    ],
  },
  {
    key: "marketing_agency", label: "Marketing Agency",
    pages: [
      page({ key: "ag-audit", name: "Free marketing audit", hint: "Lead magnet", title: "Get a free social media & ads audit", slug: "free-audit", button: "Get my free audit",
        intro: "We review your Instagram, website and ads and send a video report with quick wins.",
        benefitsTitle: "Your audit covers", benefits: ["Profile & content review", "Ad account health & wasted spend", "Competitor comparison", "A 30-day growth action plan"],
        steps: ["Share your handle and website", "We record your audit in 48 hours", "Book a call to discuss (optional)"],
        quote: "\"Found ₹40k/month of wasted ad spend in the first audit.\" — Client",
        faq: [["Is it really free?", "Yes, no card required."], ["How long does it take?", "You receive it within 48 working hours."]] }),
      page({ key: "ag-retainer", name: "Monthly retainer", hint: "Service package", title: "Done-for-you social media management", slug: "smm-package", button: "Start now", mrp: "29999", offer: "19999",
        intro: "Content, posting, ads and reporting — handled by our team every month.",
        benefitsTitle: "Every month you get", benefits: ["12 posts + 8 reels designed & published", "Meta ads management", "Comment & DM automation setup", "Monthly performance report"],
        steps: ["Pay and fill the onboarding form", "Kick-off call within 48 hours", "Content goes live in week 1"],
        quote: "\"Leads doubled in 3 months.\" — D2C brand",
        faq: [["Is there a lock-in?", "No, cancel anytime with 15 days' notice."], ["Is ad spend included?", "No, ad budget is paid directly to Meta."]] }),
      page({ key: "ag-strategy", name: "Strategy call", hint: "Paid consultation", title: "60-minute growth strategy session", slug: "strategy-call", button: "Book session", mrp: "4999", offer: "2499",
        intro: "A focused session to build your marketing plan, funnel and budget.",
        benefitsTitle: "You'll leave with", benefits: ["A custom marketing roadmap", "Channel & budget split", "Funnel and offer feedback"],
        steps: ["Pay and pick a slot", "Fill a short brief", "Join the video call"],
        quote: "\"Worth 10x the fee.\" — Founder",
        faq: [["Will I get a recording?", "Yes, sent after the call."]] }),
    ],
    products: [
      { name: "Social media management (monthly)", price: "19999", mrp: "29999", desc: "Content, posting & reporting" },
      { name: "Meta ads management", price: "14999", mrp: "24999", desc: "Campaign setup & optimisation" },
      { name: "Website / landing page", price: "24999", mrp: "39999", desc: "Conversion-focused design" },
      { name: "Growth strategy session", price: "2499", mrp: "4999", desc: "60-minute expert call" },
    ],
    coupons: [
      { name: "First month discount", prefix: "FIRST", discount: "30% off first month" },
      { name: "Annual plan", prefix: "ANNUAL", discount: "2 months free" },
      { name: "Referral reward", prefix: "REFER", discount: "₹5,000 off" },
    ],
  },
  {
    key: "education", label: "Education / Coaching",
    pages: [
      page({ key: "ed-demo", name: "Free demo class", hint: "Lead capture", title: "Book a free demo class", slug: "demo-class", button: "Book free demo",
        intro: "Experience our teaching live before you enrol.", benefitsTitle: "In the demo", benefits: ["Live class with expert faculty", "Doubt-solving session", "Personalised study plan"],
        steps: ["Pick a slot", "Get the link on WhatsApp", "Attend and decide"], quote: "\"My son loved the demo and joined the same day.\" — Parent",
        faq: [["Is it free?", "Yes, no payment needed."], ["Which classes?", "Grades 6–12 and competitive exams."]] }),
      page({ key: "ed-batch", name: "Batch enrolment", hint: "Paid course", title: "Enrol in the new batch", slug: "new-batch", button: "Enrol now", mrp: "14999", offer: "9999",
        intro: "Structured live classes, tests and mentorship.", benefitsTitle: "What's included", benefits: ["Live + recorded classes", "Weekly tests with analysis", "Study material PDFs", "1:1 mentor support"],
        steps: ["Pay securely", "Receive joining details", "Start classes"], quote: "\"Scored 95% after joining.\" — Student",
        faq: [["Are EMIs available?", "Message us for EMI options."]] }),
    ],
    products: [
      { name: "Full course enrolment", price: "9999", mrp: "14999", desc: "Live classes + material" },
      { name: "Test series", price: "999", mrp: "2499", desc: "Mock tests with analysis" },
      { name: "Study notes PDF", price: "299", mrp: "699", desc: "Chapter-wise notes" },
    ],
    coupons: [
      { name: "Early bird batch", prefix: "EARLY", discount: "20% off" },
      { name: "Sibling discount", prefix: "SIBLING", discount: "15% off" },
      { name: "Scholarship", prefix: "SCHOLAR", discount: "Up to 50% off" },
    ],
  },
  {
    key: "healthcare", label: "Healthcare / Clinic",
    pages: [
      page({ key: "hc-appointment", name: "Doctor appointment", hint: "Consultation booking", title: "Book a consultation", slug: "book-consultation", button: "Book appointment", mrp: "800", offer: "500",
        intro: "In-clinic or video consultation with experienced doctors.", benefitsTitle: "Why patients choose us", benefits: ["Experienced specialists", "Minimal waiting time", "Digital prescription", "Free follow-up within 7 days"],
        steps: ["Choose a time slot", "Pay consultation fee", "Visit or join the video call"], quote: "\"Caring doctor and very little waiting.\" — Patient",
        faq: [["Can I reschedule?", "Yes, up to 2 hours before your slot."], ["Is this for emergencies?", "No. For emergencies please visit the nearest hospital."]] }),
      page({ key: "hc-package", name: "Health checkup package", hint: "Diagnostics", title: "Full body health checkup", slug: "health-checkup", button: "Book checkup", mrp: "4999", offer: "1999",
        intro: "80+ tests with free home sample collection.", benefitsTitle: "Package includes", benefits: ["80+ tests incl. thyroid, sugar, lipid", "Free home sample collection", "Reports in 24 hours", "Doctor review of reports"],
        steps: ["Book and pay", "Sample collected at home", "Reports on WhatsApp"], quote: "\"Quick, professional and affordable.\" — Customer",
        faq: [["Is fasting needed?", "Yes, 10–12 hours of fasting is recommended."]] }),
    ],
    products: [
      { name: "Doctor consultation", price: "500", mrp: "800", desc: "In-clinic or video" },
      { name: "Full body checkup", price: "1999", mrp: "4999", desc: "80+ tests, home collection" },
      { name: "Diet consultation", price: "799", mrp: "1499", desc: "Personalised diet plan" },
    ],
    coupons: [
      { name: "Senior citizen", prefix: "SENIOR", discount: "20% off" },
      { name: "Family package", prefix: "FAMILY", discount: "25% off" },
      { name: "First visit", prefix: "FIRSTVISIT", discount: "₹200 off" },
    ],
  },
  {
    key: "fitness", label: "Fitness / Gym",
    pages: [
      page({ key: "fit-program", name: "Transformation program", hint: "Paid program", title: "12-week body transformation program", slug: "transformation", button: "Join program", mrp: "9999", offer: "4999",
        intro: "Workout plans, diet and weekly coach check-ins.", benefitsTitle: "You get", benefits: ["Custom workout plan", "Indian diet plan", "Weekly coach check-ins", "Progress tracking"],
        steps: ["Join and fill the fitness form", "Get your plan in 24 hours", "Start training"], quote: "\"Lost 9 kg in 12 weeks.\" — Member",
        faq: [["Home or gym?", "Both options are available."]] }),
      page({ key: "fit-trial", name: "Free gym trial", hint: "Lead capture", title: "Claim your free 3-day gym pass", slug: "free-trial", button: "Claim free pass",
        intro: "Try our gym, classes and trainers free for 3 days.", benefitsTitle: "Your pass includes", benefits: ["Full gym access", "1 group class", "Free fitness assessment"],
        steps: ["Fill your details", "Show the pass at reception", "Start training"], quote: "\"Best trainers in the area.\" — Member", faq: [["Any charges?", "No, it's completely free."]] }),
    ],
    products: [
      { name: "Monthly membership", price: "1999", mrp: "2999", desc: "Full gym access" },
      { name: "Personal training (12 sessions)", price: "7999", mrp: "11999", desc: "1:1 coach" },
      { name: "Online diet plan", price: "999", mrp: "1999", desc: "Custom Indian diet" },
    ],
    coupons: [
      { name: "New Year resolution", prefix: "FIT2027", discount: "30% off" },
      { name: "Couple membership", prefix: "COUPLE", discount: "20% off" },
      { name: "Bring a friend", prefix: "BUDDY", discount: "1 month free" },
    ],
  },
  {
    key: "beauty", label: "Salon / Beauty",
    pages: [
      page({ key: "bt-bridal", name: "Bridal package", hint: "Service booking", title: "Bridal makeup & beauty package", slug: "bridal-package", button: "Book trial", mrp: "29999", offer: "19999",
        intro: "HD/airbrush makeup, hair and pre-bridal care by senior artists.", benefitsTitle: "Package includes", benefits: ["Bridal HD makeup & hairstyling", "Pre-bridal facial & spa", "Draping & accessories setting", "Free trial session"],
        steps: ["Pay booking amount", "Schedule your trial", "Glow on your big day"], quote: "\"Looked exactly how I dreamed.\" — Bride", faq: [["Do you travel to venue?", "Yes, venue service is available."]] }),
    ],
    products: [
      { name: "Bridal package", price: "19999", mrp: "29999", desc: "Makeup, hair & pre-bridal" },
      { name: "Hair spa", price: "999", mrp: "1499", desc: "Deep nourishing treatment" },
      { name: "Facial + cleanup", price: "1299", mrp: "1999", desc: "Glow facial" },
    ],
    coupons: [
      { name: "First visit", prefix: "WELCOME", discount: "20% off" },
      { name: "Wedding season", prefix: "BRIDE", discount: "₹3,000 off" },
      { name: "Weekday offer", prefix: "WEEKDAY", discount: "15% off" },
    ],
  },
  {
    key: "restaurant", label: "Restaurant / Café",
    pages: [
      page({ key: "rs-table", name: "Table / party booking", hint: "Booking", title: "Reserve your table", slug: "reserve-table", button: "Reserve now",
        intro: "Birthdays, dates or team dinners — reserve in seconds.", benefitsTitle: "Why book", benefits: ["Guaranteed seating", "Complimentary dessert for celebrations", "Custom party menus"],
        steps: ["Choose date and guests", "Get confirmation on WhatsApp", "Enjoy your meal"], quote: "\"Amazing food and service.\" — Guest", faq: [["Can I cancel?", "Yes, message us anytime before your booking."]] }),
    ],
    products: [
      { name: "Party package (10 guests)", price: "7999", mrp: "9999", desc: "Buffet + decoration" },
      { name: "Gift voucher", price: "1000", mrp: "1100", desc: "Dine-in voucher" },
      { name: "Cooking masterclass", price: "1499", mrp: "2499", desc: "Learn from our chef" },
    ],
    coupons: [
      { name: "Weekend brunch", prefix: "BRUNCH", discount: "15% off" },
      { name: "Birthday treat", prefix: "BDAY", discount: "Free dessert" },
      { name: "Happy hours", prefix: "HAPPY", discount: "Buy 1 get 1" },
    ],
  },
  {
    key: "ecommerce", label: "E-commerce / Fashion",
    pages: [
      page({ key: "ec-drop", name: "Product drop / sale", hint: "Product sale", title: "New collection — limited stock", slug: "new-collection", button: "Shop now", mrp: "2499", offer: "1299",
        intro: "Fresh styles, premium fabric, free shipping across India.", benefitsTitle: "Why shop here", benefits: ["Free shipping & COD", "7-day easy returns", "Premium quality fabric", "Secure payment"],
        steps: ["Pay securely", "Order ships in 24 hours", "Delivered in 3–5 days"], quote: "\"Fits perfectly and quality is great.\" — Customer",
        faq: [["How do returns work?", "Request a return within 7 days of delivery."], ["Is COD available?", "Message us to place a COD order."]] }),
    ],
    products: [
      { name: "Bestseller product", price: "1299", mrp: "2499", desc: "Free shipping" },
      { name: "Combo pack", price: "1999", mrp: "3999", desc: "Save more on bundles" },
      { name: "Gift card", price: "1000", mrp: "1000", desc: "Shop anything" },
    ],
    coupons: [
      { name: "First order", prefix: "FIRST", discount: "10% off" },
      { name: "End of season sale", prefix: "EOSS", discount: "40% off" },
      { name: "Free shipping", prefix: "FREESHIP", discount: "Free shipping" },
      { name: "Flash sale", prefix: "FLASH", discount: "25% off" },
    ],
  },
  {
    key: "travel", label: "Travel / Tours",
    pages: [
      page({ key: "tr-package", name: "Tour package", hint: "Trip booking", title: "Manali 5N/6D group trip", slug: "tour-package", button: "Book your seat", mrp: "18999", offer: "12999",
        intro: "Stay, travel, meals and sightseeing — all included.", benefitsTitle: "Inclusions", benefits: ["Volvo travel + hotel stay", "Breakfast & dinner", "Sightseeing with guide", "24×7 trip coordinator"],
        steps: ["Pay booking amount", "Get itinerary & group link", "Pack and go"], quote: "\"Best trip of my life, perfectly managed.\" — Traveller",
        faq: [["Is the booking amount refundable?", "As per the cancellation policy on this page."]] }),
    ],
    products: [
      { name: "Tour booking amount", price: "4999", mrp: "6999", desc: "Seat reservation" },
      { name: "Custom itinerary", price: "999", mrp: "1999", desc: "Personalised trip plan" },
      { name: "Visa assistance", price: "2499", mrp: "3999", desc: "Documentation help" },
    ],
    coupons: [
      { name: "Early booking", prefix: "EARLY", discount: "₹2,000 off" },
      { name: "Group of 4+", prefix: "GROUP", discount: "10% off" },
      { name: "Honeymoon special", prefix: "HONEY", discount: "Free candle-light dinner" },
    ],
  },
  {
    key: "insurance", label: "Insurance",
    pages: [
      page({ key: "in-quote", name: "Free policy quote", hint: "Lead capture", title: "Compare insurance plans & get a free quote", slug: "insurance-quote", button: "Get free quote",
        intro: "Health, term and motor insurance from top insurers — unbiased advice.", benefitsTitle: "Why us", benefits: ["Compare plans from 20+ insurers", "Claim assistance support", "IRDAI-licensed advisors", "No spam calls"],
        steps: ["Share basic details", "Get compared quotes", "Buy with expert help"], quote: "\"They helped settle my claim quickly.\" — Policyholder",
        faq: [["Is advice free?", "Yes, there's no charge for comparing plans."], ["Are premiums fixed?", "Final premium depends on the insurer's underwriting."]] }),
    ],
    products: [
      { name: "Insurance portfolio review", price: "499", mrp: "999", desc: "Check gaps in existing cover" },
      { name: "Claim assistance service", price: "1999", mrp: "3999", desc: "End-to-end claim support" },
    ],
    coupons: [
      { name: "Free review", prefix: "REVIEW", discount: "100% off review" },
      { name: "Family cover", prefix: "FAMILY", discount: "₹500 off" },
    ],
  },
  {
    key: "professional", label: "CA / Legal / Consulting",
    pages: [
      page({ key: "pr-itr", name: "ITR / GST filing", hint: "Service booking", title: "Hassle-free ITR & GST filing", slug: "tax-filing", button: "File now", mrp: "2499", offer: "999",
        intro: "Expert CA-assisted filing, done in 48 hours.", benefitsTitle: "Included", benefits: ["CA-assisted filing", "Maximum eligible deductions", "Notice support", "Acknowledgement on WhatsApp"],
        steps: ["Pay and upload documents", "CA prepares your return", "Filed and acknowledged"], quote: "\"Got my refund in record time.\" — Client",
        faq: [["Which documents are needed?", "Form 16, bank statements and investment proofs."]] }),
    ],
    products: [
      { name: "ITR filing", price: "999", mrp: "2499", desc: "CA-assisted" },
      { name: "GST registration", price: "1999", mrp: "3999", desc: "Complete registration" },
      { name: "Legal consultation", price: "1499", mrp: "2999", desc: "30-minute call" },
      { name: "Company registration", price: "6999", mrp: "11999", desc: "Pvt Ltd incorporation" },
    ],
    coupons: [
      { name: "Tax season", prefix: "TAX", discount: "20% off" },
      { name: "Startup special", prefix: "STARTUP", discount: "₹1,000 off" },
    ],
  },
];

export function industryByKey(key: string | null | undefined): Industry {
  return INDUSTRIES.find((i) => i.key === key) ?? INDUSTRIES[0]!;
}

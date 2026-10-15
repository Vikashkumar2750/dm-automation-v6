/** Ready-made rule messages (shared by the rule editor and dashboard template cards). */
export const MESSAGE_TEMPLATES: Array<{
  label: string;
  text: string;
  variations: string[];
  comment: string;
  commentVariations: string[];
}> = [
  {
    label: "Price enquiry",
    text: "Thanks for asking! Sharing our pricing and packages with you right now 👇",
    variations: [
      "Hi! Here are our current plans and prices — have a look 👇",
      "Happy to help! Sending the price list your way 👇",
      "Thanks for your interest — full pricing details below 👇",
    ],
    comment: "Just sent you the pricing in DM 📩",
    commentVariations: [
      "Check your inbox — details sent 📩",
      "DM kar diya hai, please check 📩",
      "Sent you everything in a message 📩",
    ],
  },
  {
    label: "Send the link",
    text: "Here you go! Tap the link below to see everything.",
    variations: [
      "All the details are on this link 👇",
      "Sharing the link — take a look and tell me what you think.",
      "Link niche hai, koi bhi sawal ho to bataiye!",
    ],
    comment: "Link bhej diya hai DM me 📩",
    commentVariations: [
      "Sent the link in your inbox 📩",
      "Check DM — link shared 📩",
      "Just messaged you the link 📩",
    ],
  },
  {
    label: "Thanks + follow up",
    text: "Thank you so much for reaching out! How can we help you today?",
    variations: [
      "Hey, thanks for the message! What would you like to know?",
      "Thanks for getting in touch — tell us what you need 🙂",
      "Hi! We're here to help. What are you looking for?",
    ],
    comment: "Thanks for commenting! Replied in DM 📩",
    commentVariations: [
      "Appreciate it! Check your inbox 📩",
      "Thanks 🙏 sent you a message",
      "Answered you in DM 📩",
    ],
  },
  {
    label: "Order / booking",
    text: "Great choice! Share your name and city and we'll confirm your order.",
    variations: [
      "Awesome — send your name + city and we'll book it for you.",
      "Let's get you started! Reply with your name and city.",
      "Sure! Bas apna naam aur city bhej dijiye, hum confirm kar denge.",
    ],
    comment: "Details DM me bhej diye hain 📩",
    commentVariations: [
      "Sent the booking steps in DM 📩",
      "Check inbox to place your order 📩",
      "Messaged you how to order 📩",
    ],
  },
  {
    label: "Hinglish · Link bhejo",
    text: "Heyy 👋 comment karne ke liye thank you! Ye raha aapka link — ek baar zaroor dekhna 💛",
    variations: [
      "Hii! Aapne pucha tha na, ye lo link 👇 koi doubt ho to yahin message kar dena 😊",
      "Thank you yaar 🙌 Link niche hai, abhi check karo!",
      "Aapke liye special link 👇 dekh ke batana kaisa laga!",
    ],
    comment: "DM check karo, link bhej diya hai 💌",
    commentVariations: ["Inbox me aa gaya hoga 📩", "Bhej diya! DM dekho 😊", "Aapka link DM me hai ✨"],
  },
  {
    label: "Hinglish · Price batao",
    text: "Hii 😊 Price aur saari details aapko DM me bhej di hain. Koi bhi sawal ho to bindaas pucho!",
    variations: [
      "Hello ji 🙏 Price list ye rahi 👇 aapke liye best option bhi suggest kar sakte hain.",
      "Thanks for asking! Saare plans aur price niche diye hain 👇",
      "Hey! Details bhej rahe hain — dekh ke batao kaunsa pasand aaya 😍",
    ],
    comment: "Price DM kar diya hai 📩",
    commentVariations: ["Details inbox me bhej di 😊", "DM check karo ji 📩", "Sab bata diya DM me ✨"],
  },
  {
    label: "Hinglish · Freebie / guide",
    text: "Aapka free guide ready hai 🎁 Niche tap karo aur abhi download karo!",
    variations: [
      "Ye lo aapka freebie 🎉 enjoy karo aur share bhi karna!",
      "Promise ke mutabik — free guide 👇",
      "Yay! Aapka gift aa gaya 🎁 link niche hai.",
    ],
    comment: "Freebie DM me bhej diya 🎁",
    commentVariations: ["Gift inbox me hai 🎉", "Check DM, free guide sent 📩", "Bhej diya, enjoy! 😊"],
  },
  {
    label: "Hinglish · Webinar / register",
    text: "Seat book karne ke liye thank you 🙌 Niche button se register kar lo, limited seats hain!",
    variations: [
      "Register yahan se karo 👇 milte hain live session me!",
      "Aapka registration link ready hai ✨ jaldi karo!",
      "Join karne ka link 👇 reminder bhi bhej denge 😊",
    ],
    comment: "Registration link DM kar diya 📩",
    commentVariations: ["Inbox check karo, link bheja hai 😊", "DM me register link hai ✨", "Bhej diya ji 🙏"],
  },
];

/**
 * YouTube-ready packs: public replies only, no DM wording (YouTube has no DMs),
 * and generic enough to feel natural under almost any comment. The AI still
 * reads each comment and writes a contextual reply — these are only the
 * fallback when AI is unavailable.
 */

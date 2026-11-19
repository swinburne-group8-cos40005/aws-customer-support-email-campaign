import { type Segment } from "@/types"

export const initialSegments: Segment[] = [
  {
    id: 1,
    name: "Engaged subscribers",
    desc: "Opened or clicked in the last 30 days",
    contacts: "8,420",
    growth: "+12%",
  },
  {
    id: 2,
    name: "All active customers",
    desc: "Customers with an active subscription",
    contacts: "12,840",
    growth: "+5%",
  },
  {
    id: 3,
    name: "New signups",
    desc: "Joined your audience in the last 14 days",
    contacts: "1,249",
    growth: "+24%",
  },
  {
    id: 4,
    name: "At-risk customers",
    desc: "No activity in the last 60 days",
    contacts: "2,316",
    growth: "-3%",
  },
]

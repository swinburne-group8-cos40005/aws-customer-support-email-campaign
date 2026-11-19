export const templates = [
  {
    id: 1,
    name: "Minimal update",
    category: "Newsletter",
    color: "bg-[#E9E3D4]",
    accent: "bg-[#29302B]",
  },
  {
    id: 2,
    name: "Product launch",
    category: "Announcement",
    color: "bg-[#DFE9F1]",
    accent: "bg-[#3D5D76]",
  },
  {
    id: 3,
    name: "Spring collection",
    category: "Promotion",
    color: "bg-[#F2DED7]",
    accent: "bg-[#B55F47]",
  },
  {
    id: 4,
    name: "Simple note",
    category: "Plain text",
    color: "bg-[#EEEDE9]",
    accent: "bg-[#DC2626]",
  },
  {
    id: 5,
    name: "Event invite",
    category: "Invitation",
    color: "bg-[#E5E0F2]",
    accent: "bg-[#4C3B73]",
  },
  {
    id: 6,
    name: "Weekly digest",
    category: "Newsletter",
    color: "bg-[#DDEBE3]",
    accent: "bg-[#317056]",
  },
]

export type Template = (typeof templates)[number]

import Link from "next/link";

const cards = [
  {
    href: "/admin/cvs",
    title: "CVs",
    description: "Create and manage multiple CVs for different positions.",
    icon: "☰",
  },
];

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-light text-[#1a2744] mb-2">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-10">Manage your CV content.</p>

      <div className="grid md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white border border-gray-200 p-8 hover:border-[#1a2744] transition-colors group"
          >
            <span className="text-3xl mb-4 block text-gray-300 group-hover:text-[#1a2744] transition-colors">
              {card.icon}
            </span>
            <h2 className="text-base font-semibold text-[#1a2744] mb-2">{card.title}</h2>
            <p className="text-sm text-gray-500">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

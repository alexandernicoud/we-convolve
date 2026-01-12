import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const footerLinks = {
  products: [
    { name: "Live Trading Bots", href: "/products/live-bots" },
    { name: "Train Bot", href: "/products/train-bot" },
    { name: "Backtest", href: "/products/backtest" },
    { name: "Generate Data", href: "/products/generate-data" },
    { name: "Optimize Labeling", href: "/products/optimize-labeling" },
  ],
  company: [
    { name: "Vision", href: "/vision" },
    { name: "Founder", href: "/founder" },
    { name: "Contact", href: "/contact" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-white/8 bg-[#070815]/80 backdrop-blur-sm mt-24">
      <div className="container-aligned py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4 group">
              <img src={logo} alt="convolve" className="w-8 h-8 filter hue-rotate-220 brightness-110" />
              <span className="text-[#F5F7FF] font-bold text-lg tracking-tight group-hover:text-[#7C5CFF] transition-colors">
                convolve
              </span>
            </Link>
            <p className="text-[#F5F7FF]/62 text-sm leading-relaxed">
              Visual intelligence for financial markets. Perceive differently.
            </p>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-sm font-semibold text-[#F5F7FF] mb-4 uppercase tracking-wider">
              Products
            </h4>
            <ul className="space-y-3">
              {footerLinks.products.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-[#F5F7FF]/62 hover:text-[#22D3EE] transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-[#F5F7FF] mb-4 uppercase tracking-wider">
              Company
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-[#F5F7FF]/62 hover:text-[#22D3EE] transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-[#F5F7FF] mb-4 uppercase tracking-wider">
              Legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-[#F5F7FF]/62 hover:text-[#22D3EE] transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[#F5F7FF]/62">
            {new Date().getFullYear()} convolve. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#F5F7FF]/62 hover:text-[#22D3EE] transition-colors"
            >
              <span className="text-sm">Twitter</span>
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#F5F7FF]/62 hover:text-[#22D3EE] transition-colors"
            >
              <span className="text-sm">LinkedIn</span>
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#F5F7FF]/62 hover:text-[#22D3EE] transition-colors"
            >
              <span className="text-sm">GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

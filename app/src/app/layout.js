import Providers from "../components/Providers";
import "./globals.css";

export const metadata = {
  title: "HoodMeet",
  description: "Wallet-native video rooms",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

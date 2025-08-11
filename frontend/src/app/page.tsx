import { Header } from '@/components/layout/Header';
import { WalletInstructions } from '@/components/wallet/WalletInstructions';
import { TrendingUp, DollarSign, Users, Flame } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Wallet Instructions */}
        <WalletInstructions />

        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="relative flex place-items-center justify-center mb-8 before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40 before:lg:h-[360px] z-[-1]">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white">
              Trade the Future
            </h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-4">
            The viral prediction market on Solana. Trade outcomes with bonding curves, earn from accuracy, and watch markets pump.
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            Dynamic pricing • Instant settlement • Social trading
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/markets"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl"
            >
              Start Trading
            </a>
            <a
              href="/markets"
              className="px-8 py-3 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-semibold rounded-lg transition-colors"
            >
              Browse Markets
            </a>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid text-center lg:max-w-5xl lg:w-full lg:mx-auto lg:grid-cols-4 gap-6 mb-16">
          <div className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-8 transition-all hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 dark:hover:border-blue-600">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
              Bonding Curves
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Smart pricing that rewards early believers and responds to market demand.
            </p>
          </div>

          <div className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-8 transition-all hover:border-green-300 hover:shadow-lg hover:-translate-y-1 dark:hover:border-green-600">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
              Instant Trading
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Trade outcome tokens instantly with automated market making.
            </p>
          </div>

          <div className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-8 transition-all hover:border-purple-300 hover:shadow-lg hover:-translate-y-1 dark:hover:border-purple-600">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
              Social Mechanics
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Follow top traders, share predictions, and climb the leaderboards.
            </p>
          </div>

          <div className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-8 transition-all hover:border-orange-300 hover:shadow-lg hover:-translate-y-1 dark:hover:border-orange-600">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Flame className="w-6 h-6 text-orange-600" />
            </div>
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
              Viral Growth
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Hot markets get more visibility. Create events that capture attention.
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-2xl p-8">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Join the Prediction Revolution
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Real numbers from our growing community
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">$2.4M</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Volume</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">1,247</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Traders</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">89</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Live Markets</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-1">94%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Accuracy Rate</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
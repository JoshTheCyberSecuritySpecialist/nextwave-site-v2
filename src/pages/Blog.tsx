import { motion } from 'framer-motion';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, BlogPost } from '../lib/supabase';

export const Blog = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeMessage, setSubscribeMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const categories = [
    { id: 'all', name: 'All Posts' },
    { id: 'Web Development', name: 'Web Development' },
    { id: 'Cybersecurity', name: 'Cybersecurity' },
    { id: 'AI Automation', name: 'AI Automation' },
    { id: 'IT Support', name: 'IT Support' },
    { id: 'Case Studies', name: 'Case Studies' },
  ];

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts =
    selectedCategory === 'all'
      ? posts
      : posts.filter((post) => post.category === selectedCategory);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setSubscribeMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    try {
      setSubscribing(true);
      setSubscribeMessage(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscribe-newsletter`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email: email.toLowerCase() }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setSubscribeMessage({ type: 'error', text: 'This email is already subscribed' });
        } else {
          setSubscribeMessage({ type: 'error', text: data.error || 'Something went wrong. Please try again.' });
        }
      } else {
        setSubscribeMessage({ type: 'success', text: 'Thanks for subscribing! Check your inbox.' });
        setEmail('');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      setSubscribeMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="pt-32 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Blog & Insights
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Expert insights on web development, cybersecurity, automation, and IT support
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <motion.button
              key={category.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                selectedCategory === category.id
                  ? 'bg-gradient-to-r from-[#2283B8] to-[#2BB0E8] text-white shadow-lg shadow-[#2283B8]/50'
                  : 'bg-[#001F33]/40 border border-[#2283B8]/30 text-gray-300 hover:border-[#2BB0E8]/50'
              }`}
            >
              {category.name}
            </motion.button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#2283B8]"></div>
            <p className="mt-4 text-gray-400">Loading articles...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No articles found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post, index) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -8 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#2283B8]/20 to-[#2BB0E8]/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <Link to={`/blog/${post.slug}`} className="block relative h-full">
                  <div className="h-full p-8 bg-[#001F33]/40 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl hover:border-[#2BB0E8]/50 transition-all">
                    <div className="flex items-center space-x-2 text-sm text-gray-400 mb-4">
                      <Calendar size={16} />
                      <span>{formatDate(post.published_at)}</span>
                      <span>•</span>
                      <Clock size={16} />
                      <span>{post.read_time} min</span>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-4 group-hover:text-[#2BB0E8] transition-colors">
                      {post.title}
                    </h2>

                    <p className="text-gray-300 mb-6 leading-relaxed line-clamp-3">{post.excerpt}</p>

                    <div className="flex items-center justify-between">
                      <div className="inline-block px-3 py-1 bg-[#2283B8]/10 text-[#2283B8] rounded-full text-xs font-medium">
                        {post.category}
                      </div>

                      <div className="flex items-center space-x-2 text-[#2BB0E8] font-medium group-hover:space-x-3 transition-all">
                        <span>Read More</span>
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-24 p-12 bg-gradient-to-br from-[#2283B8]/10 to-[#2BB0E8]/10 backdrop-blur-sm border border-[#2283B8]/30 rounded-3xl text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Want to stay updated?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Get the latest insights delivered to your inbox
          </p>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={subscribing}
              className="flex-1 px-6 py-4 bg-[#003B5C]/50 border border-[#2283B8]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#2BB0E8] focus:ring-1 focus:ring-[#2BB0E8] transition-colors disabled:opacity-50"
            />
            <motion.button
              type="submit"
              disabled={subscribing}
              whileHover={{ scale: subscribing ? 1 : 1.05 }}
              whileTap={{ scale: subscribing ? 1 : 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-[#2283B8] to-[#2BB0E8] text-white rounded-lg font-semibold hover:shadow-xl hover:shadow-[#2283B8]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {subscribing ? 'Subscribing...' : 'Subscribe'}
            </motion.button>
          </form>
          {subscribeMessage && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 text-sm ${
                subscribeMessage.type === 'success' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {subscribeMessage.text}
            </motion.p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

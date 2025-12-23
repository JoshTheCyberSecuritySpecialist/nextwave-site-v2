import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Calendar, Clock, ArrowLeft, User } from 'lucide-react';
import { supabase, BlogPost } from '../lib/supabase';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadPost();
    }
  }, [slug]);

  const loadPost = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: postData, error: postError } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

      if (postError) throw postError;
      if (!postData) {
        setError('Blog post not found');
        setLoading(false);
        return;
      }

      setPost(postData);

      document.title = `${postData.title} | NextWave Digital Solutions`;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', postData.excerpt);
      }

      const { data: related } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('category', postData.category)
        .eq('status', 'published')
        .neq('id', postData.id)
        .order('published_at', { ascending: false })
        .limit(3);

      if (related) {
        setRelatedPosts(related);
      }
    } catch (err) {
      console.error('Error loading post:', err);
      setError('Failed to load blog post');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0F1E]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#2283B8]"></div>
          <p className="mt-4 text-gray-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0F1E]">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Article Not Found</h1>
          <p className="text-gray-400 mb-8">{error || 'The article you are looking for does not exist.'}</p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#2283B8] text-white rounded-lg hover:bg-[#1a6a94] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E]">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-12 sm:pb-20">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-[#2283B8] hover:text-[#1a6a94] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <div className="mb-8">
          <div className="inline-block px-4 py-1 bg-[#2283B8]/10 text-[#2283B8] rounded-full text-sm font-medium mb-4">
            {post.category}
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{post.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(post.published_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{post.read_time} min read</span>
            </div>
          </div>
        </div>

        {post.featured_image && (
          <div className="mb-12 rounded-xl overflow-hidden">
            <img
              src={post.featured_image}
              alt={post.title}
              className="w-full h-auto"
            />
          </div>
        )}

        <div className="prose prose-invert prose-lg max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-3xl font-bold text-white mt-8 mb-4">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-2xl font-bold text-white mt-8 mb-4">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-xl font-bold text-white mt-6 mb-3">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="text-gray-300 mb-4 leading-relaxed">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-2">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="text-gray-300">{children}</li>
              ),
              strong: ({ children }) => (
                <strong className="text-white font-semibold">{children}</strong>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-[#2283B8] hover:text-[#1a6a94] transition-colors underline"
                  target={href?.startsWith('http') ? '_blank' : undefined}
                  rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-[#2283B8] pl-4 italic text-gray-400 my-4">
                  {children}
                </blockquote>
              ),
              code: ({ children }) => (
                <code className="bg-[#1a2332] text-[#2283B8] px-2 py-1 rounded text-sm">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="bg-[#1a2332] p-4 rounded-lg overflow-x-auto my-4">
                  {children}
                </pre>
              ),
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>
      </article>

      {relatedPosts.length > 0 && (
        <section className="bg-[#0d1424] py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white mb-8">Related Articles</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.id}
                  to={`/blog/${relatedPost.slug}`}
                  className="bg-[#0A0F1E] rounded-xl overflow-hidden border border-gray-800 hover:border-[#2283B8] transition-all duration-300 group"
                >
                  <div className="p-6">
                    <div className="inline-block px-3 py-1 bg-[#2283B8]/10 text-[#2283B8] rounded-full text-xs font-medium mb-3">
                      {relatedPost.category}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#2283B8] transition-colors">
                      {relatedPost.title}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                      {relatedPost.excerpt}
                    </p>
                    <div className="flex items-center gap-4 text-gray-500 text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(relatedPost.published_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{relatedPost.read_time} min</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

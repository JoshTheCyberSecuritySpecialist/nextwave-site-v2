import { useState, useEffect, FormEvent } from 'react';
import { supabase, BlogPost } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { apiUrl } from '../lib/payments-client.mjs';
import { Plus, CreditCard as Edit2, Trash2, Save, X } from 'lucide-react';

interface PostForm {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  read_time: number;
  featured_image: string;
  status: 'draft' | 'published';
}

export default function BlogAdmin() {
  const { session } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generateNotice, setGenerateNotice] = useState('');
  const [formData, setFormData] = useState<PostForm>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category: 'Web Development',
    author: 'NextWave Team',
    read_time: 5,
    featured_image: '',
    status: 'draft',
  });

  const categories = [
    'Web Development',
    'Cybersecurity',
    'AI Automation',
    'IT Support',
    'Case Studies',
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading posts:', error);
      alert('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleTitleChange = (title: string) => {
    setFormData({
      ...formData,
      title,
      slug: generateSlug(title),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: existingPost } = await supabase
        .from('blog_posts')
        .select('id, title')
        .eq('slug', formData.slug)
        .maybeSingle();

      if (existingPost && existingPost.id !== editingId) {
        alert(
          `A post with the slug "${formData.slug}" already exists.\n\nExisting post: "${existingPost.title}"\n\nPlease change your title to generate a unique slug.`
        );
        return;
      }

      const postData = {
        ...formData,
        published_at: formData.status === 'published' ? new Date().toISOString() : null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('blog_posts')
          .update(postData)
          .eq('id', editingId);

        if (error) throw error;
        alert('Post updated successfully!');
      } else {
        const { error } = await supabase.from('blog_posts').insert([postData]);

        if (error) throw error;
        alert('Post created successfully!');
      }

      localStorage.removeItem('blog_draft');
      resetForm();
      loadPosts();
    } catch (error: unknown) {
      console.error('Error saving post:', error);

      let errorMessage = 'Unknown error';
      if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'error_description' in error && typeof error.error_description === 'string') {
        errorMessage = error.error_description;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      alert(`Failed to save post: ${errorMessage}\n\nPlease check the console for more details.`);
    }
  };

  const handleEdit = (post: BlogPost) => {
    setFormData({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      author: post.author,
      read_time: post.read_time,
      featured_image: post.featured_image || '',
      status: post.status,
    });
    setEditingId(post.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);

      if (error) throw error;
      alert('Post deleted successfully!');
      loadPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    }
  };

  const generateDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (generating) return;
    const data = new FormData(event.currentTarget);
    setGenerating(true);
    setGenerateError('');
    setGenerateNotice('');
    try {
      const token = session?.access_token;
      if (!token) throw Error('You are not authorized to generate a draft.');
      const response = await fetch(apiUrl('/api/admin/blog-drafts', { dev: import.meta.env.DEV, configured: import.meta.env.VITE_API_BASE_URL }), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          topic: data.get('topic'),
          keywords: data.get('keywords'),
          audience: data.get('audience'),
          category: data.get('category'),
          length: data.get('length'),
          requestId: crypto.randomUUID(),
        }),
      });
      const body = await response.json().catch(() => null) as { error?: string; id?: string; title?: string; slug?: string; excerpt?: string; content?: string; category?: string; author?: string; status?: 'draft'; readTime?: number } | null;
      if (!response.ok || !body?.id || body.status !== 'draft') throw Error(body?.error || 'The draft could not be saved.');
      setFormData({
        title: body.title || '',
        slug: body.slug || '',
        excerpt: body.excerpt || '',
        content: body.content || '',
        category: body.category || 'Web Development',
        author: body.author || 'NextWave Team',
        read_time: body.readTime || 5,
        featured_image: '',
        status: 'draft',
      });
      setEditingId(body.id);
      setShowGenerate(false);
      setShowForm(true);
      setGenerateNotice('Draft saved. Review it, then publish it yourself when it is ready.');
      await loadPosts();
    } catch (reason) {
      setGenerateError(reason instanceof Error ? reason.message : 'The draft could not be saved.');
    } finally {
      setGenerating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      category: 'Web Development',
      author: 'NextWave Team',
      read_time: 5,
      featured_image: '',
      status: 'draft',
    });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0F1E] pt-32 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Blog Admin</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => { setShowGenerate(true); setGenerateError(''); }}
            className="px-6 py-3 border border-[#2BB0E8] text-white rounded-lg hover:bg-[#2283B8]/20 transition-colors"
          >
            Generate with AI
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#2283B8] text-white rounded-lg hover:bg-[#1a6a94] transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Post
          </button>
        </div>
        </div>

        {generateNotice && <p className="mb-6 text-[#7dd3f5]">{generateNotice}</p>}

        {showGenerate && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-[#0d1424] rounded-xl p-8 max-w-xl w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Generate a draft</h2>
                <button type="button" onClick={() => setShowGenerate(false)} className="text-gray-400 hover:text-white" disabled={generating}><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={event => { void generateDraft(event); }} className="space-y-4">
                <label className="block text-sm text-gray-300">Blog topic
                  <input name="topic" required minLength={8} maxLength={200} className="mt-2 w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white" />
                </label>
                <label className="block text-sm text-gray-300">Target keywords
                  <input name="keywords" maxLength={200} className="mt-2 w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white" />
                </label>
                <label className="block text-sm text-gray-300">Category
                  <select name="category" defaultValue="Web Development" className="mt-2 w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white">
                    {categories.map(category => <option key={category}>{category}</option>)}
                  </select>
                </label>
                <label className="block text-sm text-gray-300">Target audience
                  <input name="audience" maxLength={160} className="mt-2 w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white" />
                </label>
                <label className="block text-sm text-gray-300">Article length
                  <select name="length" defaultValue="standard" className="mt-2 w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white">
                    <option value="short">Short</option>
                    <option value="standard">Standard</option>
                    <option value="long">Long</option>
                  </select>
                </label>
                {generateError && <p role="alert" className="text-red-200">{generateError}</p>}
                <button type="submit" disabled={generating} className="w-full px-6 py-3 bg-[#2283B8] text-white rounded-lg disabled:opacity-60">
                  {generating ? 'Generating draft…' : 'Generate Draft'}
                </button>
              </form>
            </div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-[#0d1424] rounded-xl p-8 max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingId ? 'Edit Post' : 'Create New Post'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#2283B8]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Slug (auto-generated)
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#2283B8]"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#2283B8]"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Read Time (minutes)
                    </label>
                    <input
                      type="number"
                      value={formData.read_time}
                      onChange={(e) =>
                        setFormData({ ...formData, read_time: parseInt(e.target.value) })
                      }
                      className="w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#2283B8]"
                      required
                      min="1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Author
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#2283B8]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Featured Image URL (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.featured_image}
                    onChange={(e) =>
                      setFormData({ ...formData, featured_image: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#2283B8]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Excerpt
                  </label>
                  <textarea
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#2283B8] h-24 resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Content (Markdown)
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0A0F1E] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#2283B8] h-64 resize-none font-mono text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Status
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="draft"
                        checked={formData.status === 'draft'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            status: e.target.value as 'draft' | 'published',
                          })
                        }
                        className="text-[#2283B8] focus:ring-[#2283B8]"
                      />
                      <span className="text-gray-300">Draft</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="published"
                        checked={formData.status === 'published'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            status: e.target.value as 'draft' | 'published',
                          })
                        }
                        className="text-[#2283B8] focus:ring-[#2283B8]"
                      />
                      <span className="text-gray-300">Published</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#2283B8] text-white rounded-lg hover:bg-[#1a6a94] transition-colors"
                  >
                    <Save className="w-5 h-5" />
                    {editingId ? 'Update Post' : 'Create Post'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#2283B8]"></div>
            <p className="mt-4 text-gray-400">Loading posts...</p>
          </div>
        ) : (
          <div className="bg-[#0d1424] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#0A0F1E]">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Title
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Category
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Date
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-[#0A0F1E] transition-colors">
                    <td className="px-6 py-4 text-white">{post.title}</td>
                    <td className="px-6 py-4 text-gray-400">{post.category}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          post.status === 'published'
                            ? 'bg-[#2283B8]/10 text-[#2283B8]'
                            : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(post.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(post)}
                          className="p-2 text-[#2283B8] hover:bg-[#2283B8]/10 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {posts.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                No posts yet. Create your first post!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

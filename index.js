const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

const User = require('./models/User');
const Post = require('./models/Post');
const Comment = require('./models/Comment');

mongoose.connect('mongodb://0.0.0.0:27017/social-media', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to database'))
.catch((err) => console.error(err));

app.use(bodyParser.json());

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, 'secret_key');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

app.post('/api/authenticate', (req, res) => {
  const email = 'test@example.com';
  const password = 'password';

  if (req.body.email === email && req.body.password === password) {
    const token = jwt.sign({ email: email }, 'secret_key', { expiresIn: '1h' });
    res.json({ token: token });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/api/follow/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { followers: req.user.email } },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: 'Could not follow user' });
  }
});

app.post('/api/unfollow/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $pull: { followers: req.user.email } },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: 'Could not unfollow user' });
  }
});

app.get('/api/user', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    const numFollowers = user.followers.length;
    const numFollowing = user.following.length;
    res.json({
      name: user.name,
      followers: numFollowers,
      following: numFollowing,
    });
  } catch (err) {
    res.status(400).json({ error: 'Could not get user profile' });
  }
});

app.post('/api/posts', authenticate, async (req, res) => {
  try {
    const post = new Post({
      title: req.body.title,
      description: req.body.description,
      author: req.user.email,
      createdAt: new Date(),
    });
    const savedPost = await post.save();
    res.json(savedPost);
  } catch (err) {
    res.status(400).json({ error: 'Could not create post' });
  }
});

app.delete('/api/posts/:id', authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (post.author !== req.user.email) {
      res.status(401).json({ error: 'Unauthorized' });
    } else {
      await Post.deleteOne({ _id: req.params.id });
      res.json({ message: 'Post deleted successfully' });
    }
  } catch (err) {
    res.status(400).json({ error: 'Could not delete post' });
  }
});

app.post('/api/like/:id', authenticate, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    if (post.likes.includes(userId)) {
      return res.status(400).json({ message: 'Already liked this post' });
    }
    post.likes.push(userId);
    await post.save();
    
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post('/api/unlike/:id', authenticate, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    if (!post.likes.includes(userId)) {
      return res.status(400).json({ message: 'Post not liked yet' });
    }
    post.likes.pull(userId);
    await post.save();
    
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post('/api/comment/:id', authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const comment = new Comment({
      text: req.body.text,
      author: req.user.email,
      post: post._id,
      createdAt: new Date(),
    });
    const savedComment = await comment.save();
    res.json({ commentId: savedComment._id });
  } catch (err) {
    res.status(400).json({ error: 'Could not add comment' });
  }
});

app.get('/api/posts/:id', authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const numLikes = post.likes.length;
    const comments = await Comment.find({ post: post._id }).populate('author');
    const numComments = comments.length;
    res.json({
      _id: post._id,
      title: post.title,
      description: post.description,
      author: post.author,
      createdAt: post.createdAt,
      likes: numLikes,
      comments: numComments,
    });
  } catch (err) {
    res.status(400).json({ error: 'Could not get post' });
  }
});

app.get('/api/posts', authenticate, async (req, res) => {
try {
const posts = await Post.find().populate('comments');
res.json(posts);
} catch (err) {
res.status(400).json({ error: 'Could not get posts' });
}
});

app.get('/api/all_posts', authenticate, async (req, res) => {
  try {
    const posts = await Post.find({ author: req.user.email }).sort({ createdAt: -1 });
    const postArray = posts.map((post) => ({
      id: post._id,
      title: post.title,
      desc: post.description,
      created_at: post.createdAt,
      comments: post.comments,
      likes: post.likes.length,
    }));
    res.json(postArray);
  } catch (err) {
    res.status(400).json({ error: 'Could not get posts' });
  }
});

app.listen(port, () => {
console.log(`Server started on port ${port}`);
});
// --- 👑 SYSTEM ADMINISTRATION: IDENTITY OPERATIONS LAYER ---

// GET: Retrieve all active credentials (keeps original behavior)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Clearance denied.' });
  try { res.json(await User.find({}, 'username role password').sort({ username: 1 })); } catch (e) { res.status(500).json(e); }
});

// POST: Provision new standalone entity (keeps original behavior)
app.post('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Root assignment only.' });
  try {
    const profile = new User({ username: req.body.username, password: req.body.password, role: req.body.role });
    await profile.save(); res.status(201).json({ message: 'Identity initialized.' });
  } catch (e) { res.status(400).json({ error: 'Account handle exists on database register indices.' }); }
});

// PUT: Modify Access Rights and Security Parameters for an Existing Profile
app.put('/api/admin/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access Blocked: Account mutations require root admin authority.' });
  }
  try {
    const { password, role } = req.body;
    
    // Prevent the root admin from accidentally changing their own master role via this endpoint
    const targetUser = await User.findById(req.params.id);
    if (targetUser && targetUser.username.toLowerCase() === req.user.username.toLowerCase() && role !== 'admin') {
      return res.status(400).json({ error: 'Protection Fault: You cannot strip your own profile of administrative authority.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { password, role },
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) return res.status(404).json({ error: 'Target identity not found.' });
    res.json({ message: 'Identity credentials modified successfully.', user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: 'Database mutation failure.', details: err.message });
  }
});

// DELETE: Purge a Credential Set from System Cluster Storage Indices
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access Blocked: System account deletions require root administrative authority.' });
  }
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'Identity record missing.' });

    // Self-deletion guard block
    if (targetUser.username.toLowerCase() === req.user.username.toLowerCase()) {
      return res.status(400).json({ error: 'Protection Fault: Terminal deletion of active login session profile is blocked.' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Identity removed from registry records permanently.' });
  } catch (err) {
    res.status(500).json({ error: 'Database record removal failure.', details: err.message });
  }
});

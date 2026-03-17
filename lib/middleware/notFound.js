export function notFound(req, res) {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
}

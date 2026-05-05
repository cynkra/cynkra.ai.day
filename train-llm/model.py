"""Minimal nanoGPT-style decoder-only Transformer in Apple MLX.

Adapted from karpathy/nanoGPT and ml-explore/mlx-examples/transformer_lm.
Parametric: dimensions chosen at construction time so the same code serves
both the spike (tiny dims) and the real run (larger dims, locked by spike).

Important: this file was written without being able to execute MLX (the dev
container is Linux; MLX is Apple-only). On the first run on the Mac, expect
to fix small API mismatches if MLX has moved on. The shape math is verified
on paper; the MLX-specific calls are written from the public API as of MLX
~0.18 / mlx-examples conventions.
"""

from __future__ import annotations

from dataclasses import dataclass

import mlx.core as mx
import mlx.nn as nn


@dataclass
class GPTConfig:
    vocab_size: int        # tokenizer vocab (e.g. 2000)
    ctx_len: int           # context window (e.g. 128)
    n_layer: int           # number of transformer blocks
    n_head: int            # attention heads (must divide n_embd)
    n_embd: int            # model / embedding dimension


def _additive_causal_mask(T: int) -> mx.array:
    """Additive causal mask: 0 on/below diagonal, -inf above. Shape (T, T)."""
    idx = mx.arange(T)
    # True where j > i (future position) — those need to be masked out
    future = idx[None, :] > idx[:, None]
    return future.astype(mx.float32) * -1e9


class CausalSelfAttention(nn.Module):
    def __init__(self, cfg: GPTConfig):
        super().__init__()
        assert cfg.n_embd % cfg.n_head == 0
        self.n_head = cfg.n_head
        self.head_dim = cfg.n_embd // cfg.n_head
        self.scale = self.head_dim ** -0.5
        # fused QKV projection
        self.qkv = nn.Linear(cfg.n_embd, 3 * cfg.n_embd, bias=False)
        self.proj = nn.Linear(cfg.n_embd, cfg.n_embd, bias=False)
        # mask is built on-the-fly per forward to avoid being treated as a
        # learnable parameter by the optimizer

    def __call__(self, x: mx.array) -> mx.array:
        B, T, C = x.shape
        qkv = self.qkv(x)                                   # (B, T, 3C)
        q, k, v = mx.split(qkv, 3, axis=-1)                 # each (B, T, C)
        # split heads -> (B, n_head, T, head_dim)
        q = q.reshape(B, T, self.n_head, self.head_dim).transpose(0, 2, 1, 3)
        k = k.reshape(B, T, self.n_head, self.head_dim).transpose(0, 2, 1, 3)
        v = v.reshape(B, T, self.n_head, self.head_dim).transpose(0, 2, 1, 3)
        # scaled dot-product (B, n_head, T, T)
        att = (q @ k.transpose(0, 1, 3, 2)) * self.scale
        att = att + _additive_causal_mask(T)                # broadcast over (B, n_head)
        att = mx.softmax(att, axis=-1)
        y = att @ v                                         # (B, n_head, T, head_dim)
        y = y.transpose(0, 2, 1, 3).reshape(B, T, C)        # merge heads
        return self.proj(y)


class MLP(nn.Module):
    def __init__(self, cfg: GPTConfig):
        super().__init__()
        self.c_fc = nn.Linear(cfg.n_embd, 4 * cfg.n_embd)
        self.c_proj = nn.Linear(4 * cfg.n_embd, cfg.n_embd)

    def __call__(self, x: mx.array) -> mx.array:
        return self.c_proj(nn.gelu(self.c_fc(x)))


class Block(nn.Module):
    def __init__(self, cfg: GPTConfig):
        super().__init__()
        self.ln1 = nn.LayerNorm(cfg.n_embd)
        self.attn = CausalSelfAttention(cfg)
        self.ln2 = nn.LayerNorm(cfg.n_embd)
        self.mlp = MLP(cfg)

    def __call__(self, x: mx.array) -> mx.array:
        x = x + self.attn(self.ln1(x))
        x = x + self.mlp(self.ln2(x))
        return x


class GPT(nn.Module):
    def __init__(self, cfg: GPTConfig):
        super().__init__()
        self.cfg = cfg
        self.tok_emb = nn.Embedding(cfg.vocab_size, cfg.n_embd)
        self.pos_emb = nn.Embedding(cfg.ctx_len, cfg.n_embd)
        self.blocks = [Block(cfg) for _ in range(cfg.n_layer)]
        self.ln_f = nn.LayerNorm(cfg.n_embd)
        # output head; not tied to tok_emb to keep code simple
        self.head = nn.Linear(cfg.n_embd, cfg.vocab_size, bias=False)

    def __call__(self, idx: mx.array) -> mx.array:
        """idx: (B, T) int32/int64 token ids -> logits (B, T, vocab_size)."""
        B, T = idx.shape
        assert T <= self.cfg.ctx_len, f"sequence {T} > ctx_len {self.cfg.ctx_len}"
        pos = mx.arange(0, T)
        x = self.tok_emb(idx) + self.pos_emb(pos)
        for block in self.blocks:
            x = block(x)
        x = self.ln_f(x)
        return self.head(x)

    def num_params(self) -> int:
        """Approximate parameter count via tree traversal of model.parameters()."""
        from mlx.utils import tree_flatten
        return sum(p.size for _, p in tree_flatten(self.parameters()))

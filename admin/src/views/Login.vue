<template>
  <div class="login-page">
    <!-- 动态背景粒子 -->
    <canvas ref="bgCanvas" class="bg-canvas"></canvas>

    <!-- 浮动装饰 -->
    <div class="floating-orb orb-1"></div>
    <div class="floating-orb orb-2"></div>
    <div class="floating-orb orb-3"></div>

    <!-- 左侧品牌区 -->
    <div class="brand-section">
      <div class="brand-glow"></div>
      <div class="brand-content">
        <div class="dna-icon">
          <div class="dna-strand" v-for="i in 8" :key="i" :style="{ animationDelay: i * 0.15 + 's' }">
            <span class="dna-dot"></span>
            <span class="dna-line"></span>
            <span class="dna-dot"></span>
          </div>
        </div>
        <h1 class="brand-name">智荟华科</h1>
        <p class="brand-sub">CCPioneer · 生物仪器维修平台</p>
        <div class="brand-tags">
          <span>🔬 精准诊断</span>
          <span>📅 智能校准</span>
          <span>🔧 预防维护</span>
          <span>📋 合规审计</span>
        </div>
        <div class="brand-stat">
          <div class="stat-item"><b>16</b><span>数据表</span></div>
          <div class="stat-item"><b>60+</b><span>API端点</span></div>
          <div class="stat-item"><b>13</b><span>功能模块</span></div>
        </div>
      </div>
    </div>

    <!-- 右侧登录卡 -->
    <div class="login-section">
      <div class="login-card">
        <div class="card-header">
          <img src="/demo-lab.svg" class="header-logo" alt="智荟华科" />
          <h2>智荟华科</h2>
          <p>生物仪器一站式维修管理</p>
        </div>
        <el-form :model="form" :rules="rules" @submit.prevent="handleLogin" class="login-form">
          <div class="input-wrapper">
            <el-icon class="input-prefix"><User /></el-icon>
            <el-input v-model="form.username" placeholder="请输入用户名" size="large" class="custom-input" />
          </div>
          <div class="input-wrapper">
            <el-icon class="input-prefix"><Lock /></el-icon>
            <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" show-password class="custom-input" />
          </div>
          <button type="submit" class="login-btn" :disabled="loading">
            <span v-if="!loading">登 录 系 统</span>
            <span v-else class="loading-dots">
              <i></i><i></i><i></i>
            </span>
          </button>
        </el-form>
        <div class="card-footer">
          <span class="hint">默认账号: admin · 密码: admin123</span>
        </div>
      </div>
      <p class="copyright">© 2026 智荟华科科技 · Beijing CCPioneer Technology</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { login } from '@/api';

const router = useRouter();
const loading = ref(false);
const bgCanvas = ref(null);
const form = reactive({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

// 粒子背景动画
let animId;
function initParticles() {
  const canvas = bgCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 2 + 0.5,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    alpha: Math.random() * 0.5 + 0.2
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(22, 119, 255, ${p.alpha})`;
      ctx.fill();
      // Connect nearby particles
      for (let j = i + 1; j < particles.length; j++) {
        const dx = p.x - particles[j].x, dy = p.y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(22, 119, 255, ${0.08 * (1 - dist / 100)})`;
          ctx.stroke();
        }
      }
    });
    animId = requestAnimationFrame(draw);
  }
  draw();
}

onMounted(() => { initParticles(); window.addEventListener('resize', initParticles); });
onUnmounted(() => { cancelAnimationFrame(animId); window.removeEventListener('resize', initParticles); });

async function handleLogin() {
  if (!form.username || !form.password) return;
  loading.value = true;
  try {
    const res = await login({ username: form.username, password: form.password });
    if (res.code === 200) {
      const role = res.data?.user?.role;
      localStorage.setItem('admin_token', res.data.token);
      localStorage.setItem('admin_user', JSON.stringify(res.data.user));
      ElMessage.success(`登录成功 · ${role}`);
      router.push('/dashboard');
    } else {
      ElMessage.error(res.message || '登录失败');
    }
  } catch (e) {
    ElMessage.error('登录失败：' + (e.message || '请检查网络'));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  display: flex; height: 100vh; width: 100vw;
  background: #0a0e17; overflow: hidden; position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* 粒子背景 */
.bg-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }

/* 浮动光球 */
.floating-orb {
  position: absolute; border-radius: 50%; filter: blur(80px); z-index: 0; pointer-events: none;
}
.orb-1 { width: 400px; height: 400px; background: rgba(22, 119, 255, 0.12); top: -100px; left: 5%; animation: float1 8s ease-in-out infinite; }
.orb-2 { width: 300px; height: 300px; background: rgba(114, 46, 209, 0.10); bottom: -60px; right: 5%; animation: float2 10s ease-in-out infinite; }
.orb-3 { width: 250px; height: 250px; background: rgba(22, 119, 255, 0.08); top: 50%; left: 55%; animation: float3 12s ease-in-out infinite; }
@keyframes float1 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-40px) scale(1.1)} }
@keyframes float2 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(30px) scale(1.15)} }
@keyframes float3 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(30px,-20px)} 66%{transform:translate(-20px,30px)} }

/* 左侧品牌区 */
.brand-section {
  flex: 1; display: flex; align-items: center; justify-content: center; position: relative; z-index: 1;
}
.brand-glow {
  position: absolute; width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(22,119,255,0.06) 0%, transparent 70%);
  border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%);
}
.brand-content { position: relative; text-align: center; z-index: 2; user-select: none; }

/* DNA 图标动画 */
.dna-icon { display: flex; justify-content: center; gap: 4px; margin-bottom: 32px; height: 80px; align-items: center; }
.dna-strand { display: flex; flex-direction: column; align-items: center; gap: 12px; animation: dnaPulse 2s ease-in-out infinite; }
.dna-dot { width: 8px; height: 8px; border-radius: 50%; background: #1677FF; box-shadow: 0 0 12px rgba(22,119,255,0.6); }
.dna-line { width: 2px; height: 24px; background: linear-gradient(#1677FF, transparent); border-radius: 1px; }
@keyframes dnaPulse { 0%,100%{opacity:0.4} 50%{opacity:1} }

.brand-name { font-size: 52px; font-weight: 800; background: linear-gradient(135deg, #fff 0%, #7EB8FF 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; letter-spacing: 8px; }
.brand-sub { font-size: 16px; color: rgba(255,255,255,0.45); margin: 12px 0 36px; letter-spacing: 2px; }

.brand-tags { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-bottom: 48px; }
.brand-tags span {
  padding: 6px 18px; border-radius: 20px; font-size: 13px; color: rgba(255,255,255,0.6);
  border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);
  transition: all 0.3s;
}
.brand-tags span:hover { color: #7EB8FF; border-color: rgba(22,119,255,0.4); background: rgba(22,119,255,0.08); }

.brand-stat { display: flex; justify-content: center; gap: 48px; }
.stat-item { text-align: center; }
.stat-item b { display: block; font-size: 28px; color: #7EB8FF; font-weight: 700; }
.stat-item span { font-size: 12px; color: rgba(255,255,255,0.3); }

/* 右侧登录 */
.login-section { flex: 0 0 520px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; z-index: 1; padding: 40px; }

.login-card {
  width: 400px; background: rgba(18, 24, 40, 0.85);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px; padding: 48px 40px;
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  box-shadow: 0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04);
}

.card-header { text-align: center; margin-bottom: 36px; }
.header-icon { font-size: 40px; margin-bottom: 12px; }
.header-logo { width: 200px; height: auto; margin-bottom: 12px; }
.card-header h2 { font-size: 26px; font-weight: 700; color: #fff; margin: 0 0 8px; letter-spacing: 2px; }
.card-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin: 0; }

.login-form { display: flex; flex-direction: column; gap: 20px; }

.input-wrapper { position: relative; }
.input-prefix { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); z-index: 2; color: rgba(255,255,255,0.3); font-size: 18px; pointer-events: none; }

:deep(.custom-input) {
  --el-input-bg-color: rgba(255,255,255,0.04);
  --el-input-border-color: rgba(255,255,255,0.08);
  --el-input-hover-border-color: rgba(22,119,255,0.3);
  --el-input-focus-border-color: #1677FF;
  --el-input-text-color: #fff;
  --el-input-placeholder-color: rgba(255,255,255,0.2);
}
:deep(.custom-input .el-input__wrapper) {
  background: rgba(255,255,255,0.04); border-radius: 12px; padding-left: 44px;
  box-shadow: none; transition: all 0.3s;
}
:deep(.custom-input .el-input__wrapper:hover) { background: rgba(255,255,255,0.06); }
:deep(.custom-input .el-input__wrapper.is-focus) { background: rgba(255,255,255,0.08); box-shadow: 0 0 0 1px rgba(22,119,255,0.4); }
:deep(.custom-input .el-input__inner) { color: #fff; }
:deep(.custom-input .el-input__inner::placeholder) { color: rgba(255,255,255,0.2); }

/* 登录按钮 */
.login-btn {
  width: 100%; padding: 14px; margin-top: 8px;
  background: linear-gradient(135deg, #1677FF, #0958D9);
  border: none; border-radius: 12px; color: #fff; font-size: 16px; font-weight: 600;
  cursor: pointer; letter-spacing: 4px;
  transition: all 0.3s; position: relative; overflow: hidden;
}
.login-btn::before {
  content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
  transition: left 0.5s;
}
.login-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(22,119,255,0.35); }
.login-btn:hover:not(:disabled)::before { left: 100%; }
.login-btn:active:not(:disabled) { transform: translateY(0); }
.login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* Loading dots */
.loading-dots { display: flex; justify-content: center; gap: 6px; }
.loading-dots i { width: 8px; height: 8px; border-radius: 50%; background: #fff; animation: bounce 1.2s ease-in-out infinite; }
.loading-dots i:nth-child(2) { animation-delay: 0.2s; }
.loading-dots i:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%,80%,100%{transform:scale(0.4);opacity:0.5} 40%{transform:scale(1);opacity:1} }

.card-footer { text-align: center; margin-top: 28px; }
.hint { font-size: 12px; color: rgba(255,255,255,0.2); letter-spacing: 1px; }

.copyright { font-size: 11px; color: rgba(255,255,255,0.15); margin-top: 24px; text-align: center; }

/* 响应式 */
@media (max-width: 900px) {
  .brand-section { display: none; }
  .login-section { flex: 1; padding: 20px; }
  .login-card { width: 100%; max-width: 400px; }
}
</style>

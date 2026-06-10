<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FAZZFLY Landing Page</title>

  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&family=Noto+Sans+Thai:wght@500;600;700;800&display=swap" rel="stylesheet">

  <style>
    :root{
      --navy:#081633;
      --text:#334155;
      --muted:#64748b;
      --pink:#ff3ea5;
      --purple:#8b5cf6;
      --blue:#2563ff;
      --cyan:#38bdf8;
      --soft:#fbf7ff;
      --line:#eee7fb;
      --gradient:linear-gradient(90deg,#ff2f9f,#8b5cf6,#2563ff);
    }

    *{box-sizing:border-box}

    body{
      margin:0;
      font-family:"Inter","Noto Sans Thai",sans-serif;
      color:var(--navy);
      background:
        radial-gradient(circle at 92% 8%,rgba(255,47,159,.22),transparent 28%),
        radial-gradient(circle at 5% 85%,rgba(139,92,246,.16),transparent 28%),
        linear-gradient(135deg,#fff 0%,#fbf8ff 55%,#f4edff 100%);
    }

    .container{
      max-width:1800px;
      margin:auto;
      padding:0 56px;
    }

    .nav{
      height:110px;
      display:flex;
      align-items:center;
      justify-content:space-between;
    }

    .logo{
      width:230px;
      height:auto;
    }

    .menu{
      display:flex;
      gap:48px;
      font-weight:800;
      font-size:18px;
    }

    .btn{
      border:0;
      border-radius:16px;
      padding:18px 36px;
      font-size:19px;
      font-weight:800;
      cursor:pointer;
      font-family:inherit;
    }

    .btn-primary{
      color:#fff;
      background:var(--gradient);
      box-shadow:0 18px 40px rgba(139,92,246,.28);
    }

    .btn-light{
      background:white;
      color:#6d28d9;
      border:1px solid var(--line);
      box-shadow:0 14px 32px rgba(15,23,42,.08);
    }

    .hero{
      display:grid;
      grid-template-columns:.85fr 1.15fr;
      gap:60px;
      align-items:center;
      min-height:860px;
    }

    .hero h1{
      font-size:76px;
      line-height:1.08;
      letter-spacing:-2.5px;
      margin:0 0 28px;
      font-weight:800;
    }

    .gradient-text{
      background:var(--gradient);
      -webkit-background-clip:text;
      color:transparent;
    }

    .hero p{
      font-size:26px;
      line-height:1.55;
      color:var(--text);
      margin:0 0 36px;
      font-weight:600;
    }

    .cta-row{
      display:flex;
      gap:28px;
      margin-bottom:52px;
    }

    .features{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:28px;
    }

    .feature{
      text-align:center;
    }

    .icon{
      width:70px;
      height:70px;
      border-radius:20px;
      margin:0 auto 16px;
      display:grid;
      place-items:center;
      font-size:30px;
      background:linear-gradient(135deg,#ffe1f2,#eef2ff);
      box-shadow:0 16px 35px rgba(139,92,246,.14);
    }

    .feature strong{
      display:block;
      font-size:18px;
      margin-bottom:8px;
    }

    .feature span{
      color:var(--muted);
      font-size:14px;
      line-height:1.45;
    }

    .dashboard{
      background:rgba(255,255,255,.88);
      border:1px solid var(--line);
      border-radius:34px;
      padding:34px;
      box-shadow:0 34px 90px rgba(15,23,42,.10);
      display:grid;
      grid-template-columns:240px 1fr;
      gap:28px;
    }

    .sidebar{
      border-right:1px solid var(--line);
      padding-right:26px;
    }

    .side-logo{
      font-size:26px;
      font-weight:800;
      color:#2563ff;
      margin-bottom:28px;
    }

    .side-item{
      padding:16px 18px;
      border-radius:12px;
      margin-bottom:10px;
      font-weight:700;
      color:#334155;
    }

    .side-item.active{
      color:#7c3aed;
      background:#f0e7ff;
    }

    .dash-title{
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:26px;
    }

    .dash-title h3{
      font-size:28px;
      margin:0;
    }

    .cards{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:18px;
      margin-bottom:24px;
    }

    .kpi{
      background:white;
      border:1px solid var(--line);
      border-radius:18px;
      padding:22px;
      min-height:140px;
      box-shadow:0 12px 30px rgba(15,23,42,.05);
    }

    .kpi b{
      font-size:25px;
      display:block;
      margin-top:16px;
    }

    .up{color:#16a34a;font-weight:800;font-size:14px}
    .down{color:#ef4444;font-weight:800;font-size:14px}

    .chart-grid{
      display:grid;
      grid-template-columns:1.25fr .8fr;
      gap:22px;
      margin-bottom:22px;
    }

    .chart,.donut,.mini{
      background:white;
      border:1px solid var(--line);
      border-radius:20px;
      padding:24px;
      box-shadow:0 12px 30px rgba(15,23,42,.05);
    }

    .bars{
      display:flex;
      align-items:end;
      gap:20px;
      height:210px;
      margin-top:20px;
    }

    .bar{
      width:22px;
      border-radius:8px 8px 0 0;
      background:#2563ff;
    }

    .bar.pink{background:#ff3ea5}

    .donut-circle{
      width:180px;
      height:180px;
      border-radius:50%;
      margin:24px auto;
      background:conic-gradient(#2563ff 0 45%,#ff3ea5 45% 70%,#8b5cf6 70% 90%,#e9d5ff 90%);
      position:relative;
    }

    .donut-circle::after{
      content:"";
      position:absolute;
      inset:42px;
      background:white;
      border-radius:50%;
    }

    .mini-row{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:16px;
    }

    .solution{
      padding:80px 0;
      text-align:center;
    }

    .section-title{
      font-size:56px;
      margin:0 0 48px;
      font-weight:800;
      letter-spacing:-1.5px;
    }

    .solution-grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:34px;
    }

    .product-card{
      min-height:520px;
      border-radius:32px;
      border:1px solid var(--line);
      background:rgba(255,255,255,.78);
      box-shadow:0 28px 70px rgba(15,23,42,.08);
      padding:42px;
      display:grid;
      grid-template-columns:.9fr 1fr;
      align-items:center;
      text-align:left;
    }

    .mock-device{
      height:310px;
      border-radius:28px;
      background:linear-gradient(135deg,#fff,#f6edff);
      border:1px solid var(--line);
      display:grid;
      place-items:center;
      box-shadow:inset 0 0 0 10px rgba(255,255,255,.6);
      font-size:54px;
    }

    .product-card h3{
      font-size:42px;
      margin:0 0 18px;
      line-height:1.05;
    }

    .product-card p{
      font-size:20px;
      color:var(--text);
      line-height:1.5;
    }

    ul{
      padding:0;
      list-style:none;
      font-size:18px;
      line-height:2;
      color:#1e293b;
    }

    li::before{
      content:"✓";
      color:var(--pink);
      margin-right:10px;
      font-weight:800;
    }

    .pricing{
      padding:80px 0 110px;
      text-align:center;
    }

    .pricing-layout{
      display:grid;
      grid-template-columns:1fr 1fr 1.15fr;
      gap:30px;
      align-items:center;
    }

    .price-card{
      background:rgba(255,255,255,.8);
      border:1px solid var(--line);
      border-radius:34px;
      padding:48px 38px;
      min-height:560px;
      box-shadow:0 26px 70px rgba(15,23,42,.08);
    }

    .price-card h3{
      font-size:30px;
      margin:0 0 14px;
    }

    .price-card .plan{
      font-size:38px;
      color:var(--pink);
      font-weight:800;
      margin-bottom:42px;
    }

    .price{
      font-size:72px;
      font-weight:800;
      color:var(--pink);
      margin-bottom:10px;
    }

    .old{
      color:#94a3b8;
      font-size:34px;
      text-decoration:line-through;
      margin:30px 0;
    }

    .sub-list{
      text-align:left;
    }

    .sub-list h3{
      font-size:36px;
      margin:0 0 30px;
    }

    .sub-item{
      background:white;
      border-radius:26px;
      padding:32px;
      margin-bottom:22px;
      display:flex;
      justify-content:space-between;
      align-items:center;
      box-shadow:0 18px 45px rgba(15,23,42,.07);
      border:1px solid var(--line);
      font-size:28px;
      font-weight:800;
    }

    .sub-item span{
      font-size:42px;
    }

    .sub-item small{
      font-size:16px;
      color:var(--pink);
      display:block;
    }

    .trust-bar{
      max-width:1200px;
      margin:54px auto 0;
      background:white;
      border:1px solid var(--line);
      border-radius:999px;
      padding:24px 34px;
      display:flex;
      justify-content:center;
      gap:60px;
      font-weight:700;
      color:#334155;
      box-shadow:0 18px 45px rgba(15,23,42,.06);
    }

    @media(max-width:1100px){
      .container{padding:0 24px}
      .menu{display:none}
      .hero,.solution-grid,.pricing-layout{
        grid-template-columns:1fr;
      }
      .hero{
        padding-top:40px;
        min-height:auto;
      }
      .hero h1{font-size:54px}
      .dashboard{grid-template-columns:1fr}
      .sidebar{display:none}
      .cards,.mini-row{grid-template-columns:1fr 1fr}
      .product-card{grid-template-columns:1fr;text-align:center}
      .features{grid-template-columns:1fr 1fr}
    }

    @media(max-width:640px){
      .nav{height:88px}
      .logo{width:170px}
      .btn{padding:14px 22px;font-size:16px}
      .hero h1{font-size:42px}
      .hero p{font-size:19px}
      .cta-row{flex-direction:column}
      .features,.cards,.chart-grid,.mini-row{
        grid-template-columns:1fr;
      }
      .dashboard{padding:20px;border-radius:24px}
      .section-title{font-size:38px}
      .product-card,.price-card{padding:28px}
      .product-card h3{font-size:34px}
      .pricing-layout{gap:22px}
      .price{font-size:56px}
      .sub-item{
        flex-direction:column;
        align-items:flex-start;
        gap:14px;
      }
      .trust-bar{
        border-radius:28px;
        flex-direction:column;
        gap:14px;
      }
    }
  </style>
</head>

<body>

  <header class="container nav">
    <img src="fazzfly-logo.png" class="logo" alt="FAZZFLY">
    <nav class="menu">
      <span>WHY US</span>
      <span>ผลิตภัณฑ์ของเรา</span>
      <span>ฟีเจอร์</span>
      <span>ราคา</span>
      <span>บล็อก</span>
      <span>ติดต่อเรา</span>
    </nav>
    <button class="btn btn-primary">ทดลองใช้งานฟรี</button>
  </header>

  <main class="container">

    <section class="hero">
      <div>
        <h1>
          Meet your<br>
          <span class="gradient-text">All-in-One</span><br>
          Smart Business System
        </h1>
        <p>
          ไม่ใช่แค่ระบบจัดการ<br>
          แต่คือพาร์ทเนอร์ที่พาธุรกิจคุณโตแบบก้าวกระโดด<br>
          <span class="gradient-text">เรียนรู้วันเดียว ใช้งานได้ทันที</span>
        </p>

        <div class="cta-row">
          <button class="btn btn-primary">ทดลองใช้งานฟรี →</button>
          <button class="btn btn-light">▷ สาธิตการใช้งาน</button>
        </div>

        <div class="features">
          <div class="feature">
            <div class="icon">👥</div>
            <strong>จัดการทุกอย่าง<br>ในที่เดียว</strong>
            <span>รวมทุกฟังก์ชันที่ธุรกิจต้องใช้</span>
          </div>
          <div class="feature">
            <div class="icon">📈</div>
            <strong>ข้อมูลชัดเจน<br>ตัดสินใจไว</strong>
            <span>Dashboard เรียลไทม์</span>
          </div>
          <div class="feature">
            <div class="icon">📦</div>
            <strong>ยืดหยุ่น ปรับได้<br>ตามธุรกิจ</strong>
            <span>รองรับทุกขนาดธุรกิจ</span>
          </div>
          <div class="feature">
            <div class="icon">🛡️</div>
            <strong>ปลอดภัย มั่นใจ</strong>
            <span>ข้อมูลปลอดภัย 100%</span>
          </div>
        </div>
      </div>

      <div class="dashboard">
        <aside class="sidebar">
          <div class="side-logo">FAZZFLY</div>
          <div class="side-item active">Dashboard</div>
          <div class="side-item">CRM</div>
          <div class="side-item">Appointment</div>
          <div class="side-item">Sale</div>
          <div class="side-item">Product & Stock</div>
          <div class="side-item">Finance</div>
          <div class="side-item">Expense</div>
          <div class="side-item">Member</div>
          <div class="side-item">Report</div>
          <div class="side-item">Setting</div>
        </aside>

        <section>
          <div class="dash-title">
            <h3>Dashboard</h3>
            <strong>Fazzfly Clinic</strong>
          </div>

          <div class="cards">
            <div class="kpi">ยอดขายรวม<br><b>2,450,000</b><span class="up">↑ +12.4%</span></div>
            <div class="kpi">ต้นทุนรวม<br><b>890,000</b><span class="down">↓ -3.2%</span></div>
            <div class="kpi">กำไรรวม<br><b>1,560,000</b><span class="up">↑ +18.7%</span></div>
            <div class="kpi">จำนวนลูกค้า<br><b>1,284</b><span class="up">↑ +8.1%</span></div>
          </div>

          <div class="chart-grid">
            <div class="chart">
              <strong>ยอดขาย vs กำไร รายเดือน</strong>
              <div class="bars">
                <div class="bar" style="height:120px"></div><div class="bar pink" style="height:55px"></div>
                <div class="bar" style="height:95px"></div><div class="bar pink" style="height:48px"></div>
                <div class="bar" style="height:150px"></div><div class="bar pink" style="height:70px"></div>
                <div class="bar" style="height:110px"></div><div class="bar pink" style="height:58px"></div>
                <div class="bar" style="height:160px"></div><div class="bar pink" style="height:88px"></div>
              </div>
            </div>

            <div class="donut">
              <strong>สัดส่วนลูกค้าประเภท</strong>
              <div class="donut-circle"></div>
            </div>
          </div>

          <div class="mini-row">
            <div class="mini">นัดหมายวันนี้<br><b>23 รายการ</b></div>
            <div class="mini">Follow Up ลูกค้า<br><b>18 รายการ</b></div>
            <div class="mini">Stock Alert<br><b>7 รายการ</b></div>
            <div class="mini">คอร์สใกล้หมดอายุ<br><b>12 รายการ</b></div>
          </div>
        </section>
      </div>
    </section>

    <section class="solution">
      <h2 class="section-title">เลือกโซลูชันที่ใช่ สำหรับคุณ</h2>

      <div class="solution-grid">
        <div class="product-card">
          <div class="mock-device">🖥️</div>
          <div>
            <h3>FAZZFLY<br><span class="gradient-text">Clinic OS</span></h3>
            <p>ระบบบริหารคลินิกครบวงจร จัดการทุกอย่างในที่เดียว</p>
            <ul>
              <li>บริหารลูกค้า CRM</li>
              <li>จัดการคิวและนัดหมาย</li>
              <li>สต็อกสินค้าและคลังยา</li>
              <li>การเงินและบัญชี</li>
            </ul>
            <button class="btn btn-primary">ดูรายละเอียด</button>
          </div>
        </div>

        <div class="product-card">
          <div>
            <h3><span class="gradient-text">เลขาฟลินน์</span></h3>
            <p>เลขาส่วนตัว AI ใน LINE สำหรับฟรีแลนซ์ ครีเอเตอร์ และ Influencer</p>
            <ul>
              <li>ตอบแชทลูกค้า 24/7</li>
              <li>ออกใบเสนอราคาใน 30 วินาที</li>
              <li>ติดตามงานและแจ้งเตือน</li>
              <li>สรุปรายได้และลูกหนี้</li>
            </ul>
            <button class="btn btn-primary">ทักหาเลขาฟลินน์เลย</button>
          </div>
          <div class="mock-device">📱</div>
        </div>
      </div>
    </section>

    <section class="pricing">
      <img src="fazzfly-logo.png" class="logo" alt="FAZZFLY">
      <h2 class="section-title">Choose your plan</h2>
      <p style="font-size:24px;color:var(--muted);font-weight:700;margin-top:-30px;margin-bottom:50px;">
        เลือกแผนที่ใช่ สำหรับธุรกิจของคุณ
      </p>

      <div class="pricing-layout">
        <div class="price-card">
          <h3>Standard Bundle</h3>
          <div class="plan">CRM + ERP</div>
          <div class="price">10,999</div>
          <strong>THB / MONTH</strong>
          <div class="old">12,999</div>
          <button class="btn btn-primary">เลือกแผนนี้ →</button>
        </div>

        <div class="price-card">
          <h3>Essentials Only</h3>
          <div class="plan">CRM</div>
          <div class="price" style="color:#8b5cf6">5,999</div>
          <div class="old">7,999</div>
          <strong>ERP</strong>
          <div class="price" style="font-size:42px;color:#8b5cf6">8,999</div>
          <button class="btn btn-primary">เลือกแผนนี้ →</button>
        </div>

        <div class="sub-list">
          <h3>Subscription</h3>

          <div class="sub-item">
            <div>CRM + ERP</div>
            <div><small>MONTHLY</small><span>999</span> THB</div>
          </div>

          <div class="sub-item">
            <div>CRM</div>
            <div><small>MONTHLY</small><span>699</span> THB</div>
          </div>

          <div class="sub-item">
            <div>ERP</div>
            <div><small>MONTHLY</small><span>899</span> THB</div>
          </div>
        </div>
      </div>

      <div class="trust-bar">
        <span>🛡️ ปลอดภัย มั่นใจ ด้วยระบบมาตรฐานสากล</span>
        <span>🔒 อัปเดตฟีเจอร์ใหม่ไม่จำกัด</span>
        <span>🎧 ทีมซัพพอร์ตดูแลอย่างใกล้ชิด</span>
      </div>
    </section>

  </main>
</body>
</html>


 Logo ใส่ตรงนี้ 
<img src="fazzfly-logo.png" class="logo" alt="FAZZFLY">

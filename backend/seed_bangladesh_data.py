import os
import django
import random
from datetime import timedelta

os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()

from django.utils import timezone
from core.models import SiteSettings
from accounts.models import User, Role
from startups.models import (
    Startup, CollaborationRole, TeamMember, TimelineEvent, Document, 
    UpdateEntry, StartupComment, Application, Investment
)
from startups.services import recalculate_funding
from posts.models import Post
from messaging.models import Conversation, Message

COMMON_PASSWORD = 'DemoPass2026!#'

USERS_DATA = [
    {
        'first_name': 'Tanvir', 'last_name': 'Ahmed', 'email': 'tanvir.ahmed@demo.bd',
        'headline': 'Founder & CEO @ Chaldal Quick | Serial E-Commerce Entrepreneur',
        'bio': 'Pioneering 15-minute hyperlocal grocery delivery in Dhaka. Scaled logistics from Dhanmondi to 8 zones.',
        'location': 'Dhaka, Bangladesh',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'Logistics Optimization, Operations, Route Planning', 'experience_level': 'Founder / 8+ yrs',
        'startup_name': 'Chaldal Quick', 'startup_slug': 'chaldal-quick',
        'tagline': '15-minute fresh grocery delivery across urban Dhaka',
        'tags': ['E-Commerce', 'Logistics', 'Quick-Commerce', 'Dhaka'],
        'goal': 250000, 'external_raised': 50000, 'status': 'open',
        'overview': 'Chaldal Quick operates micro-fulfillment dark stores across Dhaka to deliver groceries and essentials in under 15 minutes.'
    },
    {
        'first_name': 'Anika', 'last_name': 'Rahman', 'email': 'anika.rahman@demo.bd',
        'headline': 'Co-Founder @ BongoPay | FinTech Angel Investor',
        'bio': 'Passionate about financial inclusion and frictionless remittance transfers for 10M+ Bangladeshi expatriates.',
        'location': 'Gulshan, Dhaka',
        'investor_type': 'Angel Investor', 'investment_budget': '$100,000 - $300,000', 'investment_interests': 'FinTech, AgriTech, SaaS',
        'skills': 'FinTech Architecture, Payment Gateways, Compliance', 'experience_level': 'Executive / 10+ yrs',
        'startup_name': 'BongoPay', 'startup_slug': 'bongopay',
        'tagline': 'Next-gen cross-border remittance and merchant MFS gateway',
        'tags': ['FinTech', 'Payments', 'MFS', 'Remittance'],
        'goal': 400000, 'external_raised': 100000, 'status': 'open',
        'overview': 'BongoPay bridges global banking rails with bKash, Nagad, and local bank accounts for instant zero-fee transfers.'
    },
    {
        'first_name': 'Farhan', 'last_name': 'Kabir', 'email': 'farhan.kabir@demo.bd',
        'headline': 'Founder @ KrishiLink | IoT & Agritech Pioneer',
        'bio': 'Empowering 50,000+ farmers across Bogura and Rangpur with direct-to-retail cold chain supply and IoT weather sensors.',
        'location': 'Bogura & Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'IoT Embedded Systems, Agriculture Supply Chain, Python', 'experience_level': 'Tech Lead / 6+ yrs',
        'startup_name': 'KrishiLink', 'startup_slug': 'krishilink',
        'tagline': 'Connecting grassroots farmers directly to urban supermarkets',
        'tags': ['AgriTech', 'IoT', 'Supply Chain', 'Fair Trade'],
        'goal': 180000, 'external_raised': 40000, 'status': 'open',
        'overview': 'KrishiLink eliminates middlemen in agricultural supply chains, increasing farmer margins by 35% through smart warehousing.'
    },
    {
        'first_name': 'Nusrat', 'last_name': 'Jahan', 'email': 'nusrat.jahan@demo.bd',
        'headline': 'Founder & Medical Director @ Sheba Care',
        'bio': 'Physician turned health-tech founder. Building primary diagnostic booths in rural Upazilas across Bangladesh.',
        'location': 'Dhanmondi, Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'Clinical Research, Telemedicine, Health Systems', 'experience_level': 'Medical Specialist / 7+ yrs',
        'startup_name': 'Sheba Care', 'startup_slug': 'sheba-care',
        'tagline': 'AI-assisted rural diagnostic clinics and video consultations',
        'tags': ['HealthTech', 'Telemedicine', 'Rural Health', 'AI Diagnostics'],
        'goal': 220000, 'external_raised': 60000, 'status': 'open',
        'overview': 'Sheba Care sets up digital health kiosks staffed by trained nurses with remote doctor consultations for rural families.'
    },
    {
        'first_name': 'Shakib', 'last_name': 'Al Hasan', 'email': 'shakib.hasan@demo.bd',
        'headline': 'CEO @ Dhaka Ride | Clean Mobility Innovator',
        'bio': 'Revolutionizing Bangladesh urban transit with retrofitted smart lithium-ion electric rickshaws and solar charging docks.',
        'location': 'Mirpur, Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'EV Battery Tech, Fleet Management, IoT Telematics', 'experience_level': 'Hardware Lead / 6+ yrs',
        'startup_name': 'Dhaka Ride', 'startup_slug': 'dhaka-ride',
        'tagline': 'Clean electric rickshaws and rapid battery-swapping stations',
        'tags': ['CleanTech', 'EV', 'Mobility', 'Renewables'],
        'goal': 300000, 'external_raised': 75000, 'status': 'open',
        'overview': 'Dhaka Ride swaps lead-acid batteries with safe, IoT-connected smart lithium battery packs in 90 seconds.'
    },
    {
        'first_name': 'Mehedi', 'last_name': 'Hasan', 'email': 'mehedi.hasan@demo.bd',
        'headline': 'Founder @ Pathshala AI | EdTech Curriculum Architect',
        'bio': 'Making quality STEM and national curriculum education personalized for 20 million Bangla-medium school students.',
        'location': 'Uttara, Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'NLP, Educational Technology, Django, React', 'experience_level': 'Senior Engineer / 5+ yrs',
        'startup_name': 'Pathshala AI', 'startup_slug': 'pathshala-ai',
        'tagline': 'Personalized AI tutor for Bengali national curriculum (Class 6-12)',
        'tags': ['EdTech', 'AI Tutor', 'Bangla NLP', 'K12'],
        'goal': 150000, 'external_raised': 35000, 'status': 'open',
        'overview': 'Pathshala AI offers step-by-step math and science problem solving in Bengali, powered by fine-tuned open models.'
    },
    {
        'first_name': 'Tasnim', 'last_name': 'Tabassum', 'email': 'tasnim.tabassum@demo.bd',
        'headline': 'Founder @ Shilpo Craft | Fair-Trade Cultural D2C',
        'bio': 'Connecting traditional Jamdani, Nakshi Kantha, and clay artisans directly with international conscious consumers.',
        'location': 'Narayanganj & Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'E-Commerce Marketing, Artisanal Supply, Export Logistics', 'experience_level': 'D2C Lead / 6+ yrs',
        'startup_name': 'Shilpo Craft', 'startup_slug': 'shilpo-craft',
        'tagline': 'Global marketplace for authentic Bangladeshi heritage crafts',
        'tags': ['D2C', 'Handicrafts', 'Fair Trade', 'Export'],
        'goal': 120000, 'external_raised': 25000, 'status': 'open',
        'overview': 'Shilpo Craft digitizes over 2,000 rural weavers and craftswomen, providing verified provenance and global shipping.'
    },
    {
        'first_name': 'Arifur', 'last_name': 'Rahman', 'email': 'arifur.rahman@demo.bd',
        'headline': 'Co-Founder @ Padma Logistics | Freight Logistics Tech',
        'bio': 'Digitizing inter-district trucking across Padma Bridge and economic corridors with GPS freight booking and real-time tracking.',
        'location': 'Chattogram & Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'Fleet Operations, Freight Brokerage, Python Backend', 'experience_level': 'Logistics Director / 9+ yrs',
        'startup_name': 'Padma Logistics', 'startup_slug': 'padma-logistics',
        'tagline': 'On-demand truck matching and freight corridor tracking in BD',
        'tags': ['Logistics', 'Trucking', 'Freight', 'B2B'],
        'goal': 350000, 'external_raised': 80000, 'status': 'open',
        'overview': 'Padma Logistics matches shippers with verified truck drivers, cutting deadhead miles by 40% along major trade routes.'
    },
    {
        'first_name': 'Sadia', 'last_name': 'Islam', 'email': 'sadia.islam@demo.bd',
        'headline': 'Founder @ Kormo Hub | Workforce & HRTech Leader',
        'bio': 'Building the talent pipeline for Bangladesh RMG and tech sectors. Verified skill assessments and digital job matching.',
        'location': 'Banani, Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'Technical Recruiting, Talent Assessment, HR Operations', 'experience_level': 'HR Lead / 7+ yrs',
        'startup_name': 'Kormo Hub', 'startup_slug': 'kormo-hub',
        'tagline': 'Verified career platform for skilled tech & industrial talent',
        'tags': ['HRTech', 'Jobs', 'Recruitment', 'Skills'],
        'goal': 160000, 'external_raised': 30000, 'status': 'open',
        'overview': 'Kormo Hub uses skill verification tests to match tech talent and certified machine operators with top enterprise employers.'
    },
    {
        'first_name': 'Rashedul', 'last_name': 'Karim', 'email': 'rashedul.karim@demo.bd',
        'headline': 'Managing Director @ Shonar Bangla Solar | Cleantech Investor',
        'bio': 'Financing commercial rooftop solar for garment manufacturing factories to slash carbon footprint and grid costs.',
        'location': 'Gazipur & Dhaka',
        'investor_type': 'Venture Partner', 'investment_budget': '$250,000 - $750,000', 'investment_interests': 'CleanTech, Renewable Energy, B2B SaaS',
        'skills': 'Solar Engineering, Project Finance, PPA Contracts', 'experience_level': 'Energy Executive / 12+ yrs',
        'startup_name': 'Shonar Bangla Solar', 'startup_slug': 'shonar-bangla-solar',
        'tagline': 'Zero-capex rooftop solar financing for export-oriented factories',
        'tags': ['Solar', 'Renewable Energy', 'RMG', 'Sustainability'],
        'goal': 500000, 'external_raised': 150000, 'status': 'open',
        'overview': 'Shonar Bangla Solar installs and operates industrial rooftop solar installations under 15-year power purchase agreements.'
    },
    {
        'first_name': 'Tahmina', 'last_name': 'Akter', 'email': 'tahmina.akter@demo.bd',
        'headline': 'Founder @ Shonchoy Micro | Micro-FinTech Pioneer',
        'bio': 'Bringing community savings groups (Shomiti) onto a safe mobile platform with automated ledgers and micro-investments.',
        'location': 'Sylhet & Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'Microfinance, Mobile UX, Community Growth', 'experience_level': 'FinTech Product Lead / 6+ yrs',
        'startup_name': 'Shonchoy Micro', 'startup_slug': 'shonchoy-micro',
        'tagline': 'Digitizing traditional community savings clubs and micro-investments',
        'tags': ['FinTech', 'Microfinance', 'Women Founders', 'Savings'],
        'goal': 200000, 'external_raised': 45000, 'status': 'open',
        'overview': 'Shonchoy Micro gives neighborhood savings groups transparent digital accounting, fraud protection, and high-yield savings.'
    },
    {
        'first_name': 'Zaved', 'last_name': 'Iqbal', 'email': 'zaved.iqbal@demo.bd',
        'headline': 'Founder @ DokanCloud | Retail SaaS Innovator',
        'bio': 'Bringing 1 million neighborhood grocery stores (Mudir Dokan) into the digital era with free inventory & bookkeeping software.',
        'location': 'Motijheel, Dhaka',
        'investor_type': 'Angel Investor', 'investment_budget': '$50,000 - $200,000', 'investment_interests': 'Retail Tech, B2B, Micro-SaaS',
        'skills': 'Cloud POS, Android App Development, Merchant Acquisition', 'experience_level': 'SaaS Founder / 8+ yrs',
        'startup_name': 'DokanCloud', 'startup_slug': 'dokancloud',
        'tagline': 'Mobile POS, digital ledger, and inventory system for neighborhood shops',
        'tags': ['RetailTech', 'SaaS', 'Micro-Merchants', 'B2B'],
        'goal': 280000, 'external_raised': 70000, 'status': 'open',
        'overview': 'DokanCloud provides a simple mobile app allowing shopkeepers to record digital baki (credit) and reorder from FMCG brands.'
    },
    {
        'first_name': 'Nafis', 'last_name': 'Fuad', 'email': 'nafis.fuad@demo.bd',
        'headline': 'CEO @ Shobuj Waste | Circular Economy Champion',
        'bio': 'Converting municipal organic waste into high-grade organic fertilizer and insect protein for aquaculture farms.',
        'location': 'Khulna & Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'Bio-conversion, Circular Economy, Agronomy', 'experience_level': 'Operations Lead / 5+ yrs',
        'startup_name': 'Shobuj Waste', 'startup_slug': 'shobuj-waste',
        'tagline': 'Urban organic waste recycling into bio-fertilizer and aquafeed',
        'tags': ['CleanTech', 'Waste Management', 'Sustainability', 'BioFertilizer'],
        'goal': 190000, 'external_raised': 40000, 'status': 'open',
        'overview': 'Shobuj Waste collects vegetable market waste and processes it using black soldier fly larvae into nutritious fish feed.'
    },
    {
        'first_name': 'Ishrat', 'last_name': 'Jahan', 'email': 'ishrat.jahan@demo.bd',
        'headline': 'Chief Scientist & Founder @ Medix Genomics',
        'bio': 'Biotechnologist dedicated to bringing personalized genomic profiling and early cancer screening to South Asia.',
        'location': 'Mohakhali, Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'Bioinformatics, Next-Gen Sequencing, Lab Automation', 'experience_level': 'PhD Scientist / 7+ yrs',
        'startup_name': 'Medix Genomics', 'startup_slug': 'medix-genomics',
        'tagline': 'Affordable genomic sequencing and early hereditary screening tests',
        'tags': ['BioTech', 'Genomics', 'HealthTech', 'Diagnostics'],
        'goal': 450000, 'external_raised': 120000, 'status': 'open',
        'overview': 'Medix Genomics slashes diagnostic turnaround times by operating the largest private DNA sequencing lab in Dhaka.'
    },
    {
        'first_name': 'Mahir', 'last_name': 'Faysal', 'email': 'mahir.faysal@demo.bd',
        'headline': 'Founder @ Khaddo Kitchens | Cloud Kitchen Infrastructure',
        'bio': 'Powering 50+ emerging virtual food brands with ready-to-cook commercial kitchen spaces and shared procurement.',
        'location': 'Bashundhara, Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'F&B Operations, Kitchen Automation, Procurement', 'experience_level': 'Hospitality Lead / 6+ yrs',
        'startup_name': 'Khaddo Kitchens', 'startup_slug': 'khaddo-kitchens',
        'tagline': 'Turnkey cloud kitchen spaces and shared procurement for food brands',
        'tags': ['FoodTech', 'Cloud Kitchens', 'Hospitality', 'QSR'],
        'goal': 175000, 'external_raised': 45000, 'status': 'open',
        'overview': 'Khaddo Kitchens provides commercial shared kitchen facilities that allow culinary creators to launch a brand in 7 days.'
    },
    {
        'first_name': 'Samia', 'last_name': 'Chowdhury', 'email': 'samia.chowdhury@demo.bd',
        'headline': 'CEO @ Nirapod Cyber | CyberSecurity Angel Investor',
        'bio': 'Ex-cybersecurity researcher at banking consortiums. Building automated fraud mitigation and NID KYC verification APIs.',
        'location': 'Gulshan, Dhaka',
        'investor_type': 'Angel Investor', 'investment_budget': '$150,000 - $400,000', 'investment_interests': 'CyberSecurity, AI, Enterprise SaaS',
        'skills': 'Penetration Testing, Cryptography, Identity Verification', 'experience_level': 'CyberSecurity Architect / 10+ yrs',
        'startup_name': 'Nirapod Cyber', 'startup_slug': 'nirapod-cyber',
        'tagline': 'AI-driven fraud prevention and e-KYC compliance APIs for Bangladeshi banks',
        'tags': ['CyberSecurity', 'e-KYC', 'FinTech', 'API'],
        'goal': 320000, 'external_raised': 90000, 'status': 'open',
        'overview': 'Nirapod Cyber prevents identity fraud and account takeover for mobile financial services using face biometric checks.'
    },
    {
        'first_name': 'Naimur', 'last_name': 'Rahman', 'email': 'naimur.rahman@demo.bd',
        'headline': 'Founder @ BariKhoj | PropTech Innovator',
        'bio': 'Eliminating shady brokerage commissions with verified direct tenant-to-landlord rental contracts and digital rent deposits.',
        'location': 'Dhanmondi, Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'Real Estate Tech, Digital Contracts, Growth Marketing', 'experience_level': 'Product Lead / 5+ yrs',
        'startup_name': 'BariKhoj', 'startup_slug': 'barikhoj',
        'tagline': 'Verified apartment rentals, virtual 3D tours, and digital tenancy agreements',
        'tags': ['PropTech', 'Real Estate', 'Rentals', 'Marketplace'],
        'goal': 210000, 'external_raised': 40000, 'status': 'open',
        'overview': 'BariKhoj lists 100% verified flats in Dhaka with zero middlemen commissions, offering escrow-protected security deposits.'
    },
    {
        'first_name': 'Humaira', 'last_name': 'Begum', 'email': 'humaira.begum@demo.bd',
        'headline': 'Founder @ Khamar Smart | Livestock Biometrics',
        'bio': 'Empowering cattle farmers and Qurbani livestock traders with computer-vision weight estimation and biometric cattle health records.',
        'location': 'Sirajganj & Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'Computer Vision, Agritech, Animal Science', 'experience_level': 'AI Researcher / 5+ yrs',
        'startup_name': 'Khamar Smart', 'startup_slug': 'khamar-smart',
        'tagline': 'AI cattle muzzle biometric identification and live health scoring',
        'tags': ['AgriTech', 'Livestock', 'Computer Vision', 'MicroInsurance'],
        'goal': 240000, 'external_raised': 50000, 'status': 'open',
        'overview': 'Khamar Smart uniquely identifies cows by muzzle patterns via smartphone camera, enabling micro-insurance and cattle loans.'
    },
    {
        'first_name': 'Asif', 'last_name': 'Mahmud', 'email': 'asif.mahmud@demo.bd',
        'headline': 'Managing Partner @ Cholo Electric | Cleantech VC',
        'bio': 'Building highway fast-charging infrastructure along the Dhaka-Chattogram corridor to accelerate national EV adoption.',
        'location': 'Chattogram & Dhaka',
        'investor_type': 'Venture Capital', 'investment_budget': '$200,000 - $600,000', 'investment_interests': 'EV Infrastructure, Clean Mobility, Energy',
        'skills': 'Power Electronics, High-Voltage Systems, Venture Capital', 'experience_level': 'Partner / 11+ yrs',
        'startup_name': 'Cholo Electric', 'startup_slug': 'cholo-electric',
        'tagline': 'Rapid DC charging network along Bangladesh national highway corridors',
        'tags': ['CleanTech', 'EV Charging', 'Infrastructure', 'Energy'],
        'goal': 380000, 'external_raised': 110000, 'status': 'open',
        'overview': 'Cholo Electric operates solar-hybrid 120kW fast chargers at highway rest stops, charging an EV in under 25 minutes.'
    },
    {
        'first_name': 'Raisa', 'last_name': 'Zaman', 'email': 'raisa.zaman@demo.bd',
        'headline': 'Founder @ AinSeva Online | LegalTech & RJSC Automation',
        'bio': 'Making corporate legal compliance, trademark filings, and RJSC company registrations seamless for Bangladeshi startups.',
        'location': 'Kawran Bazar, Dhaka',
        'investor_type': '', 'investment_budget': '', 'investment_interests': '',
        'skills': 'Corporate Law, Compliance, Legal Automation, Document AI', 'experience_level': 'Corporate Attorney / 7+ yrs',
        'startup_name': 'AinSeva Online', 'startup_slug': 'ainseva-online',
        'tagline': 'Automated legal compliance, trademark protection, and company setup',
        'tags': ['LegalTech', 'Compliance', 'RJSC', 'B2B'],
        'goal': 130000, 'external_raised': 30000, 'status': 'open',
        'overview': 'AinSeva Online generates standardized founder agreements, investor term sheets, and files statutory returns in clicks.'
    }
]

def seed_everything():
    print("=== SEEDING 20 BANGLADESHI USERS & STARTUPS ===")
    
    # 0. Create / Ensure Super Admin
    admin_user, _ = User.objects.get_or_create(email='admin@forgeflight.com')
    admin_user.first_name = 'Forge'
    admin_user.last_name = 'Admin'
    admin_user.role = Role.SUPER_ADMIN
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.is_active = True
    admin_user.email_verified = True
    admin_user.set_password('ForgeAdmin2026!#')
    admin_user.save()
    print("Created/Updated Super Admin: admin@forgeflight.com")

    # Disable mandatory admin review & auto-approve any pending startups
    SiteSettings.objects.update_or_create(pk=1, defaults={'require_startup_approval': False})
    Startup.objects.filter(review_status='pending').update(review_status='approved')
    print("Auto-approved all startups and disabled review requirement.")

    created_users = []
    created_startups = []
    
    # 1. Create Users & Startups
    for d in USERS_DATA:
        user, u_created = User.objects.get_or_create(email=d['email'])
        user.first_name = d['first_name']
        user.last_name = d['last_name']
        user.headline = d['headline']
        user.bio = d['bio']
        user.location = d['location']
        user.investor_type = d['investor_type']
        user.investment_budget = d['investment_budget']
        user.investment_interests = d['investment_interests']
        user.skills = d['skills']
        user.experience_level = d['experience_level']
        user.portfolio_link = f"https://github.com/{d['first_name'].lower()}-dev"
        user.is_active = True
        user.email_verified = True
        user.set_password(COMMON_PASSWORD)
        user.save()
        created_users.append(user)
        
        # Create Startup
        startup, s_created = Startup.objects.get_or_create(slug=d['startup_slug'], defaults={'owner': user})
        startup.name = d['startup_name']
        startup.owner = user
        startup.tagline = d['tagline']
        startup.status = d['status']
        startup.tags = d['tags']
        startup.goal = d['goal']
        startup.external_raised = d['external_raised']
        startup.raised = d['external_raised']
        startup.deadline = 'Closing in 45 days'
        startup.overview = d['overview']
        startup.verified = True
        startup.review_status = Startup.REVIEW_APPROVED
        startup.save()
        created_startups.append(startup)
        
        # Create Collaboration Role for the startup
        role_titles = [
            'Lead Full-Stack Engineer (React & Django)',
            'Growth & Digital Marketing Lead',
            'Senior Mobile App Developer (Flutter)',
            'Product Operations Manager',
            'Machine Learning & Data Specialist'
        ]
        collab_title = random.choice(role_titles)
        CollaborationRole.objects.update_or_create(
            startup=startup,
            defaults={
                'role': collab_title,
                'body': f"We are seeking an experienced {collab_title} to lead core initiatives at {startup.name}. Equity and competitive remuneration offered.",
                'is_open': True
            }
        )
        
        # Add Team members
        TeamMember.objects.get_or_create(
            startup=startup, name=f"{user.first_name} {user.last_name}",
            defaults={'title': 'Founder & CEO', 'order': 1}
        )
        TeamMember.objects.get_or_create(
            startup=startup, name=f"Co-Founder {user.last_name}",
            defaults={'title': 'Head of Engineering', 'order': 2}
        )
        
        # Add Timeline event
        TimelineEvent.objects.get_or_create(
            startup=startup, date_label='Q1 2026',
            defaults={
                'title': 'Alpha Launch & Market Pilot',
                'description': f'{startup.name} completed initial pilot with 1,000+ early adopters in Dhaka.',
                'order': 1
            }
        )
        
        print(f"Created/Updated: {user.name} ({user.email}) -> Startup: {startup.name}")

    print("\n=== CREATING CROSS-INVESTMENTS (INVESTOR PORTAL) ===")
    # Identify investor users: Anika, Rashedul, Zaved, Samia, Asif
    investors = [u for u in created_users if u.investor_type]
    
    investment_offers = [
        # (Investor, Startup_Slug, Amount, Status, Note, Accepted)
        (investors[0], 'chaldal-quick', 35000, 'accepted', 'Solid unit economics and dense dark-store network in Gulshan.', True),
        (investors[0], 'krishilink', 25000, 'accepted', 'Great mission with direct farmer procurement.', True),
        (investors[1], 'dhaka-ride', 50000, 'accepted', 'Essential clean mobility play for Dhaka clean air.', True),
        (investors[1], 'cholo-electric', 60000, 'accepted', 'Strategic fit for highway EV charging deployment.', True),
        (investors[2], 'chaldal-quick', 20000, 'accepted', 'Complementary retail distribution synergy.', True),
        (investors[2], 'pathshala-ai', 15000, 'accepted', 'Strong edtech traction among Bangla medium students.', True),
        (investors[3], 'bongopay', 75000, 'accepted', 'Critical fraud prevention & cyber defense integration.', True),
        (investors[3], 'ainseva-online', 20000, 'accepted', 'Fast-growing legaltech SaaS automation.', True),
        (investors[4], 'shonar-bangla-solar', 80000, 'accepted', 'Accelerating rooftop solar for export garment factories.', True),
        (investors[4], 'shobuj-waste', 30000, 'accepted', 'Impressive circular economy fertilizer pilot.', True),
        
        # Pending requests for founders to review in their dashboards:
        (investors[0], 'sheba-care', 30000, 'pending', 'Interested in expanding telemedicine clinics into Sylhet.', False),
        (investors[1], 'padma-logistics', 45000, 'pending', 'Evaluating inter-district fleet expansion telemetry.', False),
        (investors[2], 'shilpo-craft', 18000, 'pending', 'Would love to explore global artisan wholesale exports.', False),
        (investors[3], 'khamar-smart', 25000, 'pending', 'Exciting AI computer vision livestock biometric tech.', False),
        (investors[4], 'barikhoj', 35000, 'pending', 'Reviewing tenant rent escrow metrics.', False),
    ]

    for inv_user, s_slug, amt, st, note, is_acc in investment_offers:
        target_s = Startup.objects.get(slug=s_slug)
        if target_s.owner != inv_user:
            inv, _ = Investment.objects.update_or_create(
                startup=target_s,
                investor=inv_user,
                defaults={
                    'amount': amt,
                    'status': st,
                    'decision_note': note,
                    'decided_at': timezone.now() if st != 'pending' else None,
                    'decided_by': target_s.owner if is_acc else None
                }
            )
            if is_acc:
                recalculate_funding(target_s)
            print(f"Investment: {inv_user.name} -> {target_s.name}: ${amt:,} ({st})")

    print("\n=== CREATING COLLABORATION APPLICATIONS ===")
    collab_users = [u for u in created_users if not u.investor_type]
    
    # Send applications to startups with open roles
    app_targets = [
        (collab_users[0], 'bongopay', 'Lead Full-Stack Engineer', 'accepted'),
        (collab_users[1], 'chaldal-quick', 'Growth & Digital Marketing Lead', 'accepted'),
        (collab_users[2], 'sheba-care', 'Senior Mobile App Developer (Flutter)', 'accepted'),
        (collab_users[3], 'dhaka-ride', 'Product Operations Manager', 'pending'),
        (collab_users[4], 'pathshala-ai', 'Machine Learning & Data Specialist', 'accepted'),
        (collab_users[5], 'padma-logistics', 'Lead Full-Stack Engineer', 'pending'),
        (collab_users[6], 'kormo-hub', 'Growth & Digital Marketing Lead', 'accepted'),
        (collab_users[7], 'shonchoy-micro', 'Product Operations Manager', 'pending'),
    ]

    for applicant, s_slug, role_title, app_st in app_targets:
        target_s = Startup.objects.get(slug=s_slug)
        if target_s.owner != applicant:
            Application.objects.update_or_create(
                startup=target_s,
                applicant=applicant,
                defaults={
                    'role': role_title,
                    'name': applicant.name,
                    'email': applicant.email,
                    'link': applicant.portfolio_link,
                    'message': f"Hello {target_s.owner.first_name}, I have extensive experience in {applicant.skills}. I would love to contribute to {target_s.name}'s mission!",
                    'status': app_st,
                    'decided_at': timezone.now() if app_st != 'pending' else None,
                    'decided_by': target_s.owner if app_st == 'accepted' else None
                }
            )
            print(f"Application: {applicant.name} -> {target_s.name} for {role_title} ({app_st})")

    print("\n=== CREATING COMMUNITY CONVERSATIONS & DIRECT MESSAGES ===")
    dialogues = [
        (
            created_users[1], # Anika (Investor)
            created_startups[0], # Chaldal Quick (Tanvir)
            [
                ("Hi Tanvir, really impressed by Chaldal Quick's Q1 order volume in Dhanmondi and Gulshan! Are you planning expansion into Chattogram next quarter?", False),
                ("Hello Anika apa! Thank you so much. Yes, we have already finalized leases for two micro-fulfillment hubs in GEC Circle and Agrabad. Would love to share our unit economics deck!", True),
                ("That sounds fantastic. I have accepted your investment round allocation of $35k. Let's schedule a call this Wednesday to review the logistics fleet metrics.", False)
            ]
        ),
        (
            created_users[9], # Rashedul (Shonar Bangla Solar)
            created_startups[4], # Dhaka Ride (Shakib)
            [
                ("Shakib, great to see Dhaka Ride's electric rickshaw battery swapping stations live in Mirpur! Have you considered pairing solar rooftops with your charging docks?", False),
                ("Bhai, that's exactly what we are designing for Phase 2! Solar-assisted fast charging could lower our peak grid tariff by 45%.", True),
                ("Let's partner up. Shonar Bangla Solar can finance and install the solar canopies across your 10 planned Mirpur docks under a revenue-share model.", False)
            ]
        ),
        (
            created_users[15], # Samia (Nirapod Cyber)
            created_startups[1], # BongoPay (Anika)
            [
                ("Anika, with cross-border remittances surging, biometric e-KYC compliance is critical. Nirapod Cyber can offer sub-second facial match against NID databases.", False),
                ("Samia, we were looking for an enterprise-grade local cybersecurity partner! Let's integrate your API in our sandbox environment this week.", True)
            ]
        ),
        (
            created_users[2], # Farhan (KrishiLink)
            created_startups[14], # Khaddo Kitchens (Mahir)
            [
                ("Mahir bhai, KrishiLink can supply your 50+ cloud kitchens with farm-fresh vegetables and poultry directly from Bogura at 25% lower than wholesale market rates.", False),
                ("Farhan, that would significantly improve our kitchen margins! Can you deliver daily batches to our Banani and Dhanmondi central hubs by 6:00 AM?", True),
                ("Absolutely! Our refrigerated Padma Logistics trucks arrive in Dhaka by 4:30 AM every morning.", False)
            ]
        )
    ]

    for initiator, target_s, msgs in dialogues:
        convo, _ = Conversation.objects.get_or_create(startup=target_s, initiator=initiator)
        for text, is_founder in msgs:
            sender = target_s.owner if is_founder else initiator
            Message.objects.create(
                conversation=convo,
                sender=sender,
                text=text,
                read=True
            )
        print(f"Conversation: {initiator.name} <-> {target_s.name} ({len(msgs)} messages)")

    print("\n=== CREATING COMMUNITY POSTS & SALES CONTENT ===")
    posts_data = [
        {
            'user': created_users[0], 'startup': created_startups[0],
            'title': 'Chaldal Quick Surpasses 50,000 Deliveries in Dhaka with 12-Minute Average Time! 🚀',
            'text': 'We are thrilled to announce that Chaldal Quick has completed over 50,000 customer orders across Gulshan, Banani, and Dhanmondi! Our dark store network now boasts an average fulfillment and delivery time of just 12 minutes. Huge shoutout to our dedicated rider partners and engineering team.',
            'post_type': 'Milestone', 'tags': ['QuickCommerce', 'Milestone', 'Dhaka', 'Operations'],
            'pinned': True
        },
        {
            'user': created_users[1], 'startup': created_startups[1],
            'title': 'BongoPay Q1 Sales Update: Processed ৳45 Crore in Seamless Expatriate Remittances! 💰',
            'text': 'Our cross-border rails just hit an all-time record! In Q1 2026, over 28,000 expatriates in the Middle East and UK sent remittances home through BongoPay directly to bKash and bank accounts with zero hidden exchange markups. We are actively hiring a Lead Mobile Engineer to accelerate our iOS rollout!',
            'post_type': 'Sales Update', 'tags': ['FinTech', 'SalesUpdate', 'Remittance', 'Growth'],
            'pinned': True
        },
        {
            'user': created_users[2], 'startup': created_startups[2],
            'title': 'KrishiLink Closes B2B Supply Deal with 3 Major Supermarket Chains in Bangladesh 🌾',
            'text': 'Today KrishiLink signed long-term off-take contracts to supply fresh organic produce directly from 4,500 smallholder farmers in Bogura and Natore to leading urban retail supermarkets. Fair pricing guaranteed for farmers, fresher produce for city families!',
            'post_type': 'Partnership', 'tags': ['AgriTech', 'B2B', 'Farmers', 'Impact'],
            'pinned': False
        },
        {
            'user': created_users[4], 'startup': created_startups[4],
            'title': 'Dhaka Ride Deploys 200 Smart Electric Rickshaws in Mirpur! 🛺⚡',
            'text': 'Our lithium battery-swapping network is expanding rapidly! Over 200 electric rickshaw pullers have switched to Dhaka Ride swappable battery packs, doubling their daily take-home earnings while cutting carbon emissions. Battery swap takes only 90 seconds!',
            'post_type': 'Product Launch', 'tags': ['CleanTech', 'ElectricRickshaw', 'DhakaRide', 'Mobility'],
            'pinned': False
        },
        {
            'user': created_users[9], 'startup': created_startups[9],
            'title': 'Shonar Bangla Solar Reaches 15 Megawatts of Rooftop Solar Installed on RMG Factories! ☀️',
            'text': 'We have officially surpassed 15MW of operating clean solar capacity across 22 export garment manufacturing facilities in Gazipur and Narayanganj. Factory owners are saving an average of ৳18 Lakhs monthly on power bills while achieving international LEED green certifications.',
            'post_type': 'Case Study', 'tags': ['Renewables', 'SolarEnergy', 'RMG', 'Sustainability'],
            'pinned': False
        },
        {
            'user': created_users[5], 'startup': created_startups[5],
            'title': 'Pathshala AI Reaches 100,000 Active Students Across Bangladesh! 📚',
            'text': 'From Dinajpur to Cox\'s Bazar, students are learning difficult math and science concepts in their native Bengali language using Pathshala AI\'s conversational tutor. We are looking for angel investors and educators to help us expand to Higher Secondary curricula.',
            'post_type': 'Milestone', 'tags': ['EdTech', 'BanglaAI', 'Students', 'Education'],
            'pinned': False
        },
        {
            'user': created_users[11], 'startup': created_startups[11],
            'title': 'DokanCloud Digitizes 15,000 Neighborhood Grocery Stores in 6 Months! 🛒',
            'text': 'Neighborhood Mudir Dokans form the backbone of the retail economy in Bangladesh. With DokanCloud, over 15,000 dukandars now record customer credit (baki) digitally on their mobile phones and receive automated SMS payment reminders!',
            'post_type': 'Sales Update', 'tags': ['RetailTech', 'DokanCloud', 'SaaS', 'DigitalBD'],
            'pinned': False
        },
        {
            'user': created_users[18], 'startup': created_startups[18],
            'title': 'Cholo Electric Commissions 120kW Ultra-Fast EV Charger on Dhaka-Chattogram Highway ⚡🛣️',
            'text': 'Electric vehicle drivers can now travel between Dhaka and Chattogram with zero range anxiety! Our highway charging plaza at Comilla rest stop charges any modern EV to 80% in just 22 minutes.',
            'post_type': 'Infrastructure', 'tags': ['EV', 'HighwayCharging', 'CleanTech'],
            'pinned': False
        }
    ]

    for p in posts_data:
        post, _ = Post.objects.get_or_create(
            title=p['title'],
            defaults={
                'startup': p['startup'],
                'author': p['user'],
                'text': p['text'],
                'post_type': p['post_type'],
                'tags': p['tags'],
                'pinned': p['pinned']
            }
        )
        # Add random likes from other users
        like_users = random.sample(created_users, k=random.randint(5, 12))
        for lu in like_users:
            post.likes.add(lu)
            
        print(f"Post created: '{post.title[:50]}...' with {post.likes.count()} likes")

    print("\n=== COMPLETED SUCCESSFULLY! ALL 20 USERS, STARTUPS & INTERACTIONS SEEDED ===")

if __name__ == '__main__':
    seed_everything()

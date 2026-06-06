/**
 * Weather location registry – single source of truth for supported static-host cities.
 *
 * Release 6K / 59A update:
 * - Top 300 governed selectable weather cities.
 * - Default selected cities: Chennai, Trichy, Muscat (Colombo removed per request).
 * - Migration: configs that still carry the previously force-injected Colombo
 *   get it stripped on first load (reverses the 59A auto-restore). Users who
 *   add Colombo back themselves keep it — see getConfiguredWeatherCities.
 * - User settings store stable city keys only.
 */

export const WEATHER_LOCATION_CONFIG_VERSION = 'weather-locations-v8-colombo-removed';

export const DEFAULT_WEATHER_CITIES = ['chennai', 'trichy', 'muscat'];

// Cities that earlier versions force-injected and that the colombo-removal
// migration should strip exactly once (only while upgrading from the old
// auto-restore version).
const AUTO_RESTORE_LEGACY_CITIES = ['colombo'];
const COLOMBO_RESTORE_VERSION = 'weather-locations-v7-colombo-restored';

const LOCATION_ROWS = [
    ['chennai', 'Chennai', 'India', 'Tamil Nadu', 'Asia/Kolkata', 13.0827, 80.2707, '🏛️', ['madras']],
    ['trichy', 'Trichy', 'India', 'Tamil Nadu', 'Asia/Kolkata', 10.7905, 78.7047, '🏯', ['tiruchirappalli', 'tiruchirapalli', 'tiruchi']],
    ['mumbai', 'Mumbai', 'India', 'Maharashtra', 'Asia/Kolkata', 19.0760, 72.8777, '🌆', ['bombay']],
    ['delhi', 'Delhi', 'India', 'Delhi NCR', 'Asia/Kolkata', 28.7041, 77.1025, '🏙️', ['new delhi']],
    ['bangalore', 'Bangalore', 'India', 'Karnataka', 'Asia/Kolkata', 12.9716, 77.5946, '🌆', ['bengaluru', 'blr']],
    ['hyderabad', 'Hyderabad', 'India', 'Telangana', 'Asia/Kolkata', 17.3850, 78.4867, '🌆', []],
    ['kolkata', 'Kolkata', 'India', 'West Bengal', 'Asia/Kolkata', 22.5726, 88.3639, '🌉', ['calcutta']],
    ['pune', 'Pune', 'India', 'Maharashtra', 'Asia/Kolkata', 18.5204, 73.8567, '🌆', []],
    ['ahmedabad', 'Ahmedabad', 'India', 'Gujarat', 'Asia/Kolkata', 23.0225, 72.5714, '🏙️', []],
    ['surat', 'Surat', 'India', 'Gujarat', 'Asia/Kolkata', 21.1702, 72.8311, '🏙️', []],
    ['jaipur', 'Jaipur', 'India', 'Rajasthan', 'Asia/Kolkata', 26.9124, 75.7873, '🏰', []],
    ['lucknow', 'Lucknow', 'India', 'Uttar Pradesh', 'Asia/Kolkata', 26.8467, 80.9462, '🏙️', []],
    ['kanpur', 'Kanpur', 'India', 'Uttar Pradesh', 'Asia/Kolkata', 26.4499, 80.3319, '🏙️', []],
    ['nagpur', 'Nagpur', 'India', 'Maharashtra', 'Asia/Kolkata', 21.1458, 79.0882, '🏙️', []],
    ['indore', 'Indore', 'India', 'Madhya Pradesh', 'Asia/Kolkata', 22.7196, 75.8577, '🏙️', []],
    ['thane', 'Thane', 'India', 'Maharashtra', 'Asia/Kolkata', 19.2183, 72.9781, '🏙️', []],
    ['bhopal', 'Bhopal', 'India', 'Madhya Pradesh', 'Asia/Kolkata', 23.2599, 77.4126, '🏙️', []],
    ['visakhapatnam', 'Visakhapatnam', 'India', 'Andhra Pradesh', 'Asia/Kolkata', 17.6868, 83.2185, '🌊', ['vizag']],
    ['patna', 'Patna', 'India', 'Bihar', 'Asia/Kolkata', 25.5941, 85.1376, '🏙️', []],
    ['vadodara', 'Vadodara', 'India', 'Gujarat', 'Asia/Kolkata', 22.3072, 73.1812, '🏙️', ['baroda']],
    ['ghaziabad', 'Ghaziabad', 'India', 'Uttar Pradesh', 'Asia/Kolkata', 28.6692, 77.4538, '🏙️', []],
    ['ludhiana', 'Ludhiana', 'India', 'Punjab', 'Asia/Kolkata', 30.9010, 75.8573, '🏙️', []],
    ['agra', 'Agra', 'India', 'Uttar Pradesh', 'Asia/Kolkata', 27.1767, 78.0081, '🕌', []],
    ['nashik', 'Nashik', 'India', 'Maharashtra', 'Asia/Kolkata', 19.9975, 73.7898, '🏙️', []],
    ['faridabad', 'Faridabad', 'India', 'Haryana', 'Asia/Kolkata', 28.4089, 77.3178, '🏙️', []],
    ['meerut', 'Meerut', 'India', 'Uttar Pradesh', 'Asia/Kolkata', 28.9845, 77.7064, '🏙️', []],
    ['rajkot', 'Rajkot', 'India', 'Gujarat', 'Asia/Kolkata', 22.3039, 70.8022, '🏙️', []],
    ['varanasi', 'Varanasi', 'India', 'Uttar Pradesh', 'Asia/Kolkata', 25.3176, 82.9739, '🛕', ['banaras', 'kashi']],
    ['srinagar', 'Srinagar', 'India', 'Jammu and Kashmir', 'Asia/Kolkata', 34.0837, 74.7973, '🏔️', []],
    ['aurangabad', 'Aurangabad', 'India', 'Maharashtra', 'Asia/Kolkata', 19.8762, 75.3433, '🏙️', []],
    ['dhanbad', 'Dhanbad', 'India', 'Jharkhand', 'Asia/Kolkata', 23.7957, 86.4304, '🏙️', []],
    ['amritsar', 'Amritsar', 'India', 'Punjab', 'Asia/Kolkata', 31.6340, 74.8723, '🛕', []],
    ['navi_mumbai', 'Navi Mumbai', 'India', 'Maharashtra', 'Asia/Kolkata', 19.0330, 73.0297, '🏙️', []],
    ['allahabad', 'Prayagraj', 'India', 'Uttar Pradesh', 'Asia/Kolkata', 25.4358, 81.8463, '🏙️', ['allahabad']],
    ['ranchi', 'Ranchi', 'India', 'Jharkhand', 'Asia/Kolkata', 23.3441, 85.3096, '🏙️', []],
    ['haora', 'Howrah', 'India', 'West Bengal', 'Asia/Kolkata', 22.5958, 88.2636, '🌉', ['howrah']],
    ['coimbatore', 'Coimbatore', 'India', 'Tamil Nadu', 'Asia/Kolkata', 11.0168, 76.9558, '🏞️', ['kovai']],
    ['jabalpur', 'Jabalpur', 'India', 'Madhya Pradesh', 'Asia/Kolkata', 23.1815, 79.9864, '🏙️', []],
    ['gwalior', 'Gwalior', 'India', 'Madhya Pradesh', 'Asia/Kolkata', 26.2183, 78.1828, '🏰', []],
    ['vijayawada', 'Vijayawada', 'India', 'Andhra Pradesh', 'Asia/Kolkata', 16.5062, 80.6480, '🏙️', []],
    ['jodhpur', 'Jodhpur', 'India', 'Rajasthan', 'Asia/Kolkata', 26.2389, 73.0243, '🏰', []],
    ['madurai', 'Madurai', 'India', 'Tamil Nadu', 'Asia/Kolkata', 9.9252, 78.1198, '🛕', ['madura']],
    ['raipur', 'Raipur', 'India', 'Chhattisgarh', 'Asia/Kolkata', 21.2514, 81.6296, '🏙️', []],
    ['kota', 'Kota', 'India', 'Rajasthan', 'Asia/Kolkata', 25.2138, 75.8648, '🏙️', []],
    ['guwahati', 'Guwahati', 'India', 'Assam', 'Asia/Kolkata', 26.1445, 91.7362, '🏞️', []],
    ['chandigarh', 'Chandigarh', 'India', 'Chandigarh', 'Asia/Kolkata', 30.7333, 76.7794, '🏙️', []],
    ['mysore', 'Mysore', 'India', 'Karnataka', 'Asia/Kolkata', 12.2958, 76.6394, '🏰', ['mysuru']],
    ['mangalore', 'Mangalore', 'India', 'Karnataka', 'Asia/Kolkata', 12.9141, 74.8560, '🌊', ['mangaluru']],
    ['thiruvananthapuram', 'Thiruvananthapuram', 'India', 'Kerala', 'Asia/Kolkata', 8.5241, 76.9366, '🌴', ['trivandrum']],
    ['kochi', 'Kochi', 'India', 'Kerala', 'Asia/Kolkata', 9.9312, 76.2673, '🌴', ['cochin']],

    ['karachi', 'Karachi', 'Pakistan', 'Sindh', 'Asia/Karachi', 24.8607, 67.0011, '🌆', []],
    ['lahore', 'Lahore', 'Pakistan', 'Punjab', 'Asia/Karachi', 31.5204, 74.3587, '🏙️', []],
    ['faisalabad', 'Faisalabad', 'Pakistan', 'Punjab', 'Asia/Karachi', 31.4504, 73.1350, '🏙️', []],
    ['rawalpindi', 'Rawalpindi', 'Pakistan', 'Punjab', 'Asia/Karachi', 33.5651, 73.0169, '🏙️', []],
    ['islamabad', 'Islamabad', 'Pakistan', 'Islamabad Capital Territory', 'Asia/Karachi', 33.6844, 73.0479, '🏛️', []],
    ['dhaka', 'Dhaka', 'Bangladesh', 'Dhaka Division', 'Asia/Dhaka', 23.8103, 90.4125, '🌆', []],
    ['chittagong', 'Chittagong', 'Bangladesh', 'Chattogram Division', 'Asia/Dhaka', 22.3569, 91.7832, '🌊', ['chattogram']],
    ['khulna', 'Khulna', 'Bangladesh', 'Khulna Division', 'Asia/Dhaka', 22.8456, 89.5403, '🏙️', []],
    ['colombo', 'Colombo', 'Sri Lanka', 'Western Province', 'Asia/Colombo', 6.9271, 79.8612, '🌴', ['columbo', 'kolamba', 'sri lanka capital']],
    ['kandy', 'Kandy', 'Sri Lanka', 'Central Province', 'Asia/Colombo', 7.2906, 80.6337, '⛰️', ['mahanuwara']],
    ['galle', 'Galle', 'Sri Lanka', 'Southern Province', 'Asia/Colombo', 6.0535, 80.2210, '🌊', []],
    ['kathmandu', 'Kathmandu', 'Nepal', 'Bagmati', 'Asia/Kathmandu', 27.7172, 85.3240, '🏔️', []],
    ['pokhara', 'Pokhara', 'Nepal', 'Gandaki', 'Asia/Kathmandu', 28.2096, 83.9856, '🏔️', []],

    ['shanghai', 'Shanghai', 'China', 'Shanghai', 'Asia/Shanghai', 31.2304, 121.4737, '🌆', []],
    ['beijing', 'Beijing', 'China', 'Beijing', 'Asia/Shanghai', 39.9042, 116.4074, '🏛️', []],
    ['chongqing', 'Chongqing', 'China', 'Chongqing', 'Asia/Shanghai', 29.4316, 106.9123, '🌆', []],
    ['tianjin', 'Tianjin', 'China', 'Tianjin', 'Asia/Shanghai', 39.3434, 117.3616, '🏙️', []],
    ['guangzhou', 'Guangzhou', 'China', 'Guangdong', 'Asia/Shanghai', 23.1291, 113.2644, '🌆', ['canton']],
    ['shenzhen', 'Shenzhen', 'China', 'Guangdong', 'Asia/Shanghai', 22.5431, 114.0579, '🌆', []],
    ['chengdu', 'Chengdu', 'China', 'Sichuan', 'Asia/Shanghai', 30.5728, 104.0668, '🏙️', []],
    ['nanjing', 'Nanjing', 'China', 'Jiangsu', 'Asia/Shanghai', 32.0603, 118.7969, '🏙️', []],
    ['wuhan', 'Wuhan', 'China', 'Hubei', 'Asia/Shanghai', 30.5928, 114.3055, '🏙️', []],
    ['xian', "Xi'an", 'China', 'Shaanxi', 'Asia/Shanghai', 34.3416, 108.9398, '🏯', ['xi an']],
    ['hangzhou', 'Hangzhou', 'China', 'Zhejiang', 'Asia/Shanghai', 30.2741, 120.1551, '🏙️', []],
    ['dongguan', 'Dongguan', 'China', 'Guangdong', 'Asia/Shanghai', 23.0207, 113.7518, '🏙️', []],
    ['foshan', 'Foshan', 'China', 'Guangdong', 'Asia/Shanghai', 23.0215, 113.1214, '🏙️', []],
    ['shenyang', 'Shenyang', 'China', 'Liaoning', 'Asia/Shanghai', 41.8057, 123.4315, '🏙️', []],
    ['harbin', 'Harbin', 'China', 'Heilongjiang', 'Asia/Shanghai', 45.8038, 126.5350, '❄️', []],
    ['qingdao', 'Qingdao', 'China', 'Shandong', 'Asia/Shanghai', 36.0671, 120.3826, '🌊', []],
    ['dalian', 'Dalian', 'China', 'Liaoning', 'Asia/Shanghai', 38.9140, 121.6147, '🌊', []],
    ['zhengzhou', 'Zhengzhou', 'China', 'Henan', 'Asia/Shanghai', 34.7466, 113.6254, '🏙️', []],
    ['jinan', 'Jinan', 'China', 'Shandong', 'Asia/Shanghai', 36.6512, 117.1201, '🏙️', []],
    ['changsha', 'Changsha', 'China', 'Hunan', 'Asia/Shanghai', 28.2282, 112.9388, '🏙️', []],
    ['kunming', 'Kunming', 'China', 'Yunnan', 'Asia/Shanghai', 25.0389, 102.7183, '🏞️', []],
    ['ningbo', 'Ningbo', 'China', 'Zhejiang', 'Asia/Shanghai', 29.8683, 121.5440, '🌊', []],
    ['suzhou', 'Suzhou', 'China', 'Jiangsu', 'Asia/Shanghai', 31.2989, 120.5853, '🏙️', []],
    ['taipei', 'Taipei', 'Taiwan', 'Taipei', 'Asia/Taipei', 25.0330, 121.5654, '🏙️', []],
    ['kaohsiung', 'Kaohsiung', 'Taiwan', 'Kaohsiung', 'Asia/Taipei', 22.6273, 120.3014, '🌊', []],
    ['hong_kong', 'Hong Kong', 'Hong Kong', 'Hong Kong', 'Asia/Hong_Kong', 22.3193, 114.1694, '🌆', ['hk']],
    ['macau', 'Macau', 'Macau', 'Macau', 'Asia/Macau', 22.1987, 113.5439, '🌆', ['macao']],
    ['tokyo', 'Tokyo', 'Japan', 'Tokyo', 'Asia/Tokyo', 35.6762, 139.6503, '🗼', []],
    ['yokohama', 'Yokohama', 'Japan', 'Kanagawa', 'Asia/Tokyo', 35.4437, 139.6380, '🌊', []],
    ['osaka', 'Osaka', 'Japan', 'Osaka', 'Asia/Tokyo', 34.6937, 135.5023, '🏙️', []],
    ['nagoya', 'Nagoya', 'Japan', 'Aichi', 'Asia/Tokyo', 35.1815, 136.9066, '🏙️', []],
    ['sapporo', 'Sapporo', 'Japan', 'Hokkaido', 'Asia/Tokyo', 43.0618, 141.3545, '❄️', []],
    ['fukuoka', 'Fukuoka', 'Japan', 'Fukuoka', 'Asia/Tokyo', 33.5902, 130.4017, '🌊', []],
    ['kobe', 'Kobe', 'Japan', 'Hyogo', 'Asia/Tokyo', 34.6901, 135.1955, '🌊', []],
    ['kyoto', 'Kyoto', 'Japan', 'Kyoto', 'Asia/Tokyo', 35.0116, 135.7681, '⛩️', []],
    ['seoul', 'Seoul', 'South Korea', 'Seoul', 'Asia/Seoul', 37.5665, 126.9780, '🏙️', []],
    ['busan', 'Busan', 'South Korea', 'Busan', 'Asia/Seoul', 35.1796, 129.0756, '🌊', []],
    ['incheon', 'Incheon', 'South Korea', 'Incheon', 'Asia/Seoul', 37.4563, 126.7052, '🌊', []],
    ['daegu', 'Daegu', 'South Korea', 'Daegu', 'Asia/Seoul', 35.8714, 128.6014, '🏙️', []],
    ['daejeon', 'Daejeon', 'South Korea', 'Daejeon', 'Asia/Seoul', 36.3504, 127.3845, '🏙️', []],
    ['gwangju', 'Gwangju', 'South Korea', 'Gwangju', 'Asia/Seoul', 35.1595, 126.8526, '🏙️', []],
    ['ulaanbaatar', 'Ulaanbaatar', 'Mongolia', 'Ulaanbaatar', 'Asia/Ulaanbaatar', 47.8864, 106.9057, '🏔️', []],

    ['jakarta', 'Jakarta', 'Indonesia', 'Jakarta', 'Asia/Jakarta', -6.2088, 106.8456, '🌆', []],
    ['surabaya', 'Surabaya', 'Indonesia', 'East Java', 'Asia/Jakarta', -7.2575, 112.7521, '🏙️', []],
    ['bandung', 'Bandung', 'Indonesia', 'West Java', 'Asia/Jakarta', -6.9175, 107.6191, '🏙️', []],
    ['medan', 'Medan', 'Indonesia', 'North Sumatra', 'Asia/Jakarta', 3.5952, 98.6722, '🏙️', []],
    ['bekasi', 'Bekasi', 'Indonesia', 'West Java', 'Asia/Jakarta', -6.2383, 106.9756, '🏙️', []],
    ['tangerang', 'Tangerang', 'Indonesia', 'Banten', 'Asia/Jakarta', -6.1783, 106.6319, '🏙️', []],
    ['makassar', 'Makassar', 'Indonesia', 'South Sulawesi', 'Asia/Makassar', -5.1477, 119.4327, '🌊', []],
    ['bangkok', 'Bangkok', 'Thailand', 'Bangkok', 'Asia/Bangkok', 13.7563, 100.5018, '🌆', []],
    ['chiang_mai', 'Chiang Mai', 'Thailand', 'Chiang Mai', 'Asia/Bangkok', 18.7883, 98.9853, '⛰️', []],
    ['phuket', 'Phuket', 'Thailand', 'Phuket', 'Asia/Bangkok', 7.8804, 98.3923, '🌴', []],
    ['manila', 'Manila', 'Philippines', 'Metro Manila', 'Asia/Manila', 14.5995, 120.9842, '🌆', []],
    ['quezon_city', 'Quezon City', 'Philippines', 'Metro Manila', 'Asia/Manila', 14.6760, 121.0437, '🏙️', []],
    ['davao', 'Davao', 'Philippines', 'Davao Region', 'Asia/Manila', 7.1907, 125.4553, '🏙️', []],
    ['cebu', 'Cebu', 'Philippines', 'Central Visayas', 'Asia/Manila', 10.3157, 123.8854, '🌊', []],
    ['ho_chi_minh_city', 'Ho Chi Minh City', 'Vietnam', 'Ho Chi Minh City', 'Asia/Ho_Chi_Minh', 10.8231, 106.6297, '🌆', ['saigon']],
    ['hanoi', 'Hanoi', 'Vietnam', 'Hanoi', 'Asia/Ho_Chi_Minh', 21.0278, 105.8342, '🏙️', []],
    ['da_nang', 'Da Nang', 'Vietnam', 'Da Nang', 'Asia/Ho_Chi_Minh', 16.0544, 108.2022, '🌊', []],
    ['kuala_lumpur', 'Kuala Lumpur', 'Malaysia', 'Kuala Lumpur', 'Asia/Kuala_Lumpur', 3.1390, 101.6869, '🌆', ['kl']],
    ['george_town', 'George Town', 'Malaysia', 'Penang', 'Asia/Kuala_Lumpur', 5.4141, 100.3288, '🌊', ['penang']],
    ['johor_bahru', 'Johor Bahru', 'Malaysia', 'Johor', 'Asia/Kuala_Lumpur', 1.4927, 103.7414, '🏙️', []],
    ['singapore', 'Singapore', 'Singapore', 'Singapore', 'Asia/Singapore', 1.3521, 103.8198, '🌃', ['sg', 'sin']],
    ['yangon', 'Yangon', 'Myanmar', 'Yangon', 'Asia/Yangon', 16.8409, 96.1735, '🏙️', ['rangoon']],
    ['mandalay', 'Mandalay', 'Myanmar', 'Mandalay', 'Asia/Yangon', 21.9588, 96.0891, '🏙️', []],
    ['phnom_penh', 'Phnom Penh', 'Cambodia', 'Phnom Penh', 'Asia/Phnom_Penh', 11.5564, 104.9282, '🏙️', []],
    ['vientiane', 'Vientiane', 'Laos', 'Vientiane', 'Asia/Vientiane', 17.9757, 102.6331, '🏙️', []],
    ['sydney', 'Sydney', 'Australia', 'New South Wales', 'Australia/Sydney', -33.8688, 151.2093, '🌉', []],
    ['melbourne', 'Melbourne', 'Australia', 'Victoria', 'Australia/Melbourne', -37.8136, 144.9631, '🌆', []],
    ['brisbane', 'Brisbane', 'Australia', 'Queensland', 'Australia/Brisbane', -27.4698, 153.0251, '🌆', []],
    ['perth', 'Perth', 'Australia', 'Western Australia', 'Australia/Perth', -31.9523, 115.8613, '🌆', []],
    ['adelaide', 'Adelaide', 'Australia', 'South Australia', 'Australia/Adelaide', -34.9285, 138.6007, '🌆', []],
    ['auckland', 'Auckland', 'New Zealand', 'Auckland', 'Pacific/Auckland', -36.8509, 174.7645, '🌊', []],
    ['wellington', 'Wellington', 'New Zealand', 'Wellington', 'Pacific/Auckland', -41.2865, 174.7762, '🌊', []],

    ['dubai', 'Dubai', 'UAE', 'Dubai', 'Asia/Dubai', 25.2048, 55.2708, '🏙️', ['dxb']],
    ['abu_dhabi', 'Abu Dhabi', 'UAE', 'Abu Dhabi', 'Asia/Dubai', 24.4539, 54.3773, '🏙️', ['abudhabi', 'auh']],
    ['sharjah', 'Sharjah', 'UAE', 'Sharjah', 'Asia/Dubai', 25.3463, 55.4209, '🏙️', []],
    ['doha', 'Doha', 'Qatar', 'Doha', 'Asia/Qatar', 25.2854, 51.5310, '🌇', ['qatar capital']],
    ['riyadh', 'Riyadh', 'Saudi Arabia', 'Riyadh', 'Asia/Riyadh', 24.7136, 46.6753, '🌇', []],
    ['jeddah', 'Jeddah', 'Saudi Arabia', 'Makkah', 'Asia/Riyadh', 21.4858, 39.1925, '🌊', []],
    ['mecca', 'Mecca', 'Saudi Arabia', 'Makkah', 'Asia/Riyadh', 21.3891, 39.8579, '🕋', ['makkah']],
    ['medina', 'Medina', 'Saudi Arabia', 'Madinah', 'Asia/Riyadh', 24.5247, 39.5692, '🕌', ['madinah']],
    ['kuwait_city', 'Kuwait City', 'Kuwait', 'Al Asimah', 'Asia/Kuwait', 29.3759, 47.9774, '🏙️', []],
    ['manama', 'Manama', 'Bahrain', 'Capital Governorate', 'Asia/Bahrain', 26.2235, 50.5876, '🌆', []],
    ['muscat', 'Muscat', 'Oman', 'Muscat Governorate', 'Asia/Muscat', 23.5859, 58.4059, '🕌', ['maskad', 'masqat']],
    ['tehran', 'Tehran', 'Iran', 'Tehran', 'Asia/Tehran', 35.6892, 51.3890, '🏙️', []],
    ['mashhad', 'Mashhad', 'Iran', 'Razavi Khorasan', 'Asia/Tehran', 36.2605, 59.6168, '🏙️', []],
    ['isfahan', 'Isfahan', 'Iran', 'Isfahan', 'Asia/Tehran', 32.6539, 51.6660, '🏙️', []],
    ['shiraz', 'Shiraz', 'Iran', 'Fars', 'Asia/Tehran', 29.5918, 52.5837, '🏙️', []],
    ['baghdad', 'Baghdad', 'Iraq', 'Baghdad', 'Asia/Baghdad', 33.3152, 44.3661, '🏙️', []],
    ['basra', 'Basra', 'Iraq', 'Basra', 'Asia/Baghdad', 30.5085, 47.7804, '🏙️', []],
    ['ankara', 'Ankara', 'Turkey', 'Ankara', 'Europe/Istanbul', 39.9334, 32.8597, '🏛️', []],
    ['istanbul', 'Istanbul', 'Turkey', 'Istanbul', 'Europe/Istanbul', 41.0082, 28.9784, '🌉', []],
    ['izmir', 'Izmir', 'Turkey', 'Izmir', 'Europe/Istanbul', 38.4237, 27.1428, '🌊', []],
    ['bursa', 'Bursa', 'Turkey', 'Bursa', 'Europe/Istanbul', 40.1828, 29.0663, '🏙️', []],
    ['tel_aviv', 'Tel Aviv', 'Israel', 'Tel Aviv', 'Asia/Jerusalem', 32.0853, 34.7818, '🌊', []],
    ['jerusalem', 'Jerusalem', 'Israel', 'Jerusalem', 'Asia/Jerusalem', 31.7683, 35.2137, '🕍', []],
    ['amman', 'Amman', 'Jordan', 'Amman', 'Asia/Amman', 31.9539, 35.9106, '🏙️', []],
    ['beirut', 'Beirut', 'Lebanon', 'Beirut', 'Asia/Beirut', 33.8938, 35.5018, '🌊', []],
    ['damascus', 'Damascus', 'Syria', 'Damascus', 'Asia/Damascus', 33.5138, 36.2765, '🏙️', []],
    ['tashkent', 'Tashkent', 'Uzbekistan', 'Tashkent', 'Asia/Tashkent', 41.2995, 69.2401, '🏙️', []],
    ['almaty', 'Almaty', 'Kazakhstan', 'Almaty', 'Asia/Almaty', 43.2220, 76.8512, '🏔️', []],
    ['astana', 'Astana', 'Kazakhstan', 'Akmola', 'Asia/Almaty', 51.1694, 71.4491, '🏙️', ['nur-sultan']],

    ['london', 'London', 'United Kingdom', 'England', 'Europe/London', 51.5074, -0.1278, '🏙️', []],
    ['paris', 'Paris', 'France', 'Île-de-France', 'Europe/Paris', 48.8566, 2.3522, '🗼', []],
    ['berlin', 'Berlin', 'Germany', 'Berlin', 'Europe/Berlin', 52.5200, 13.4050, '🏙️', []],
    ['madrid', 'Madrid', 'Spain', 'Community of Madrid', 'Europe/Madrid', 40.4168, -3.7038, '🏙️', []],
    ['rome', 'Rome', 'Italy', 'Lazio', 'Europe/Rome', 41.9028, 12.4964, '🏛️', []],
    ['milan', 'Milan', 'Italy', 'Lombardy', 'Europe/Rome', 45.4642, 9.1900, '🏙️', []],
    ['barcelona', 'Barcelona', 'Spain', 'Catalonia', 'Europe/Madrid', 41.3874, 2.1686, '🌊', []],
    ['vienna', 'Vienna', 'Austria', 'Vienna', 'Europe/Vienna', 48.2082, 16.3738, '🎻', []],
    ['warsaw', 'Warsaw', 'Poland', 'Masovian', 'Europe/Warsaw', 52.2297, 21.0122, '🏙️', []],
    ['hamburg', 'Hamburg', 'Germany', 'Hamburg', 'Europe/Berlin', 53.5511, 9.9937, '🌊', []],
    ['munich', 'Munich', 'Germany', 'Bavaria', 'Europe/Berlin', 48.1351, 11.5820, '🏙️', []],
    ['prague', 'Prague', 'Czech Republic', 'Prague', 'Europe/Prague', 50.0755, 14.4378, '🏰', []],
    ['budapest', 'Budapest', 'Hungary', 'Central Hungary', 'Europe/Budapest', 47.4979, 19.0402, '🌉', []],
    ['bucharest', 'Bucharest', 'Romania', 'Bucharest', 'Europe/Bucharest', 44.4268, 26.1025, '🏙️', []],
    ['amsterdam', 'Amsterdam', 'Netherlands', 'North Holland', 'Europe/Amsterdam', 52.3676, 4.9041, '🚲', []],
    ['brussels', 'Brussels', 'Belgium', 'Brussels', 'Europe/Brussels', 50.8503, 4.3517, '🏙️', []],
    ['stockholm', 'Stockholm', 'Sweden', 'Stockholm', 'Europe/Stockholm', 59.3293, 18.0686, '🌊', []],
    ['copenhagen', 'Copenhagen', 'Denmark', 'Capital Region', 'Europe/Copenhagen', 55.6761, 12.5683, '🌊', []],
    ['oslo', 'Oslo', 'Norway', 'Oslo', 'Europe/Oslo', 59.9139, 10.7522, '🏔️', []],
    ['helsinki', 'Helsinki', 'Finland', 'Uusimaa', 'Europe/Helsinki', 60.1699, 24.9384, '🌊', []],
    ['dublin', 'Dublin', 'Ireland', 'Leinster', 'Europe/Dublin', 53.3498, -6.2603, '🍀', []],
    ['lisbon', 'Lisbon', 'Portugal', 'Lisbon', 'Europe/Lisbon', 38.7223, -9.1393, '🌊', []],
    ['porto', 'Porto', 'Portugal', 'Norte', 'Europe/Lisbon', 41.1579, -8.6291, '🌊', []],
    ['athens', 'Athens', 'Greece', 'Attica', 'Europe/Athens', 37.9838, 23.7275, '🏛️', []],
    ['zurich', 'Zurich', 'Switzerland', 'Zurich', 'Europe/Zurich', 47.3769, 8.5417, '🏔️', []],
    ['geneva', 'Geneva', 'Switzerland', 'Geneva', 'Europe/Zurich', 46.2044, 6.1432, '🏔️', []],
    ['moscow', 'Moscow', 'Russia', 'Moscow', 'Europe/Moscow', 55.7558, 37.6173, '🏙️', []],
    ['saint_petersburg', 'Saint Petersburg', 'Russia', 'Saint Petersburg', 'Europe/Moscow', 59.9311, 30.3609, '🏙️', []],
    ['kyiv', 'Kyiv', 'Ukraine', 'Kyiv', 'Europe/Kyiv', 50.4501, 30.5234, '🏙️', ['kiev']],
    ['minsk', 'Minsk', 'Belarus', 'Minsk', 'Europe/Minsk', 53.9006, 27.5590, '🏙️', []],
    ['riga', 'Riga', 'Latvia', 'Riga', 'Europe/Riga', 56.9496, 24.1052, '🏙️', []],
    ['vilnius', 'Vilnius', 'Lithuania', 'Vilnius', 'Europe/Vilnius', 54.6872, 25.2797, '🏙️', []],
    ['tallinn', 'Tallinn', 'Estonia', 'Harju', 'Europe/Tallinn', 59.4370, 24.7536, '🌊', []],
    ['sofia', 'Sofia', 'Bulgaria', 'Sofia', 'Europe/Sofia', 42.6977, 23.3219, '🏙️', []],
    ['belgrade', 'Belgrade', 'Serbia', 'Belgrade', 'Europe/Belgrade', 44.7866, 20.4489, '🏙️', []],
    ['zagreb', 'Zagreb', 'Croatia', 'Zagreb', 'Europe/Zagreb', 45.8150, 15.9819, '🏙️', []],
    ['sarajevo', 'Sarajevo', 'Bosnia and Herzegovina', 'Sarajevo', 'Europe/Sarajevo', 43.8563, 18.4131, '🏔️', []],
    ['skopje', 'Skopje', 'North Macedonia', 'Skopje', 'Europe/Skopje', 41.9981, 21.4254, '🏙️', []],
    ['tirana', 'Tirana', 'Albania', 'Tirana', 'Europe/Tirane', 41.3275, 19.8187, '🏙️', []],
    ['reykjavik', 'Reykjavik', 'Iceland', 'Capital Region', 'Atlantic/Reykjavik', 64.1466, -21.9426, '❄️', []],

    ['new_york', 'New York', 'United States', 'New York', 'America/New_York', 40.7128, -74.0060, '🗽', ['nyc']],
    ['los_angeles', 'Los Angeles', 'United States', 'California', 'America/Los_Angeles', 34.0522, -118.2437, '🌴', ['la']],
    ['chicago', 'Chicago', 'United States', 'Illinois', 'America/Chicago', 41.8781, -87.6298, '🏙️', []],
    ['houston', 'Houston', 'United States', 'Texas', 'America/Chicago', 29.7604, -95.3698, '🚀', []],
    ['phoenix', 'Phoenix', 'United States', 'Arizona', 'America/Phoenix', 33.4484, -112.0740, '🌵', []],
    ['philadelphia', 'Philadelphia', 'United States', 'Pennsylvania', 'America/New_York', 39.9526, -75.1652, '🏙️', []],
    ['san_antonio', 'San Antonio', 'United States', 'Texas', 'America/Chicago', 29.4241, -98.4936, '🏙️', []],
    ['san_diego', 'San Diego', 'United States', 'California', 'America/Los_Angeles', 32.7157, -117.1611, '🌊', []],
    ['dallas', 'Dallas', 'United States', 'Texas', 'America/Chicago', 32.7767, -96.7970, '🏙️', []],
    ['san_jose', 'San Jose', 'United States', 'California', 'America/Los_Angeles', 37.3382, -121.8863, '💻', []],
    ['austin', 'Austin', 'United States', 'Texas', 'America/Chicago', 30.2672, -97.7431, '🎸', []],
    ['jacksonville', 'Jacksonville', 'United States', 'Florida', 'America/New_York', 30.3322, -81.6557, '🌊', []],
    ['fort_worth', 'Fort Worth', 'United States', 'Texas', 'America/Chicago', 32.7555, -97.3308, '🏙️', []],
    ['columbus', 'Columbus', 'United States', 'Ohio', 'America/New_York', 39.9612, -82.9988, '🏙️', []],
    ['charlotte', 'Charlotte', 'United States', 'North Carolina', 'America/New_York', 35.2271, -80.8431, '🏙️', []],
    ['san_francisco', 'San Francisco', 'United States', 'California', 'America/Los_Angeles', 37.7749, -122.4194, '🌉', ['sf']],
    ['seattle', 'Seattle', 'United States', 'Washington', 'America/Los_Angeles', 47.6062, -122.3321, '🌧️', []],
    ['denver', 'Denver', 'United States', 'Colorado', 'America/Denver', 39.7392, -104.9903, '🏔️', []],
    ['washington_dc', 'Washington, DC', 'United States', 'District of Columbia', 'America/New_York', 38.9072, -77.0369, '🏛️', ['washington']],
    ['boston', 'Boston', 'United States', 'Massachusetts', 'America/New_York', 42.3601, -71.0589, '🏙️', []],
    ['el_paso', 'El Paso', 'United States', 'Texas', 'America/Denver', 31.7619, -106.4850, '🌵', []],
    ['detroit', 'Detroit', 'United States', 'Michigan', 'America/Detroit', 42.3314, -83.0458, '🏙️', []],
    ['nashville', 'Nashville', 'United States', 'Tennessee', 'America/Chicago', 36.1627, -86.7816, '🎵', []],
    ['portland', 'Portland', 'United States', 'Oregon', 'America/Los_Angeles', 45.5152, -122.6784, '🌲', []],
    ['memphis', 'Memphis', 'United States', 'Tennessee', 'America/Chicago', 35.1495, -90.0490, '🎵', []],
    ['oklahoma_city', 'Oklahoma City', 'United States', 'Oklahoma', 'America/Chicago', 35.4676, -97.5164, '🏙️', []],
    ['las_vegas', 'Las Vegas', 'United States', 'Nevada', 'America/Los_Angeles', 36.1699, -115.1398, '🎰', []],
    ['louisville', 'Louisville', 'United States', 'Kentucky', 'America/Kentucky/Louisville', 38.2527, -85.7585, '🏙️', []],
    ['baltimore', 'Baltimore', 'United States', 'Maryland', 'America/New_York', 39.2904, -76.6122, '🌊', []],
    ['milwaukee', 'Milwaukee', 'United States', 'Wisconsin', 'America/Chicago', 43.0389, -87.9065, '🌊', []],
    ['albuquerque', 'Albuquerque', 'United States', 'New Mexico', 'America/Denver', 35.0844, -106.6504, '🌵', []],
    ['tucson', 'Tucson', 'United States', 'Arizona', 'America/Phoenix', 32.2226, -110.9747, '🌵', []],
    ['fresno', 'Fresno', 'United States', 'California', 'America/Los_Angeles', 36.7378, -119.7871, '🏙️', []],
    ['sacramento', 'Sacramento', 'United States', 'California', 'America/Los_Angeles', 38.5816, -121.4944, '🏛️', []],
    ['atlanta', 'Atlanta', 'United States', 'Georgia', 'America/New_York', 33.7490, -84.3880, '🌆', []],
    ['miami', 'Miami', 'United States', 'Florida', 'America/New_York', 25.7617, -80.1918, '🌴', []],
    ['orlando', 'Orlando', 'United States', 'Florida', 'America/New_York', 28.5383, -81.3792, '🎢', []],
    ['tampa', 'Tampa', 'United States', 'Florida', 'America/New_York', 27.9506, -82.4572, '🌴', []],
    ['toronto', 'Toronto', 'Canada', 'Ontario', 'America/Toronto', 43.6532, -79.3832, '🏙️', []],
    ['montreal', 'Montreal', 'Canada', 'Quebec', 'America/Toronto', 45.5017, -73.5673, '🏙️', []],
    ['vancouver', 'Vancouver', 'Canada', 'British Columbia', 'America/Vancouver', 49.2827, -123.1207, '🏔️', []],
    ['calgary', 'Calgary', 'Canada', 'Alberta', 'America/Edmonton', 51.0447, -114.0719, '🏔️', []],
    ['edmonton', 'Edmonton', 'Canada', 'Alberta', 'America/Edmonton', 53.5461, -113.4938, '🏙️', []],
    ['ottawa', 'Ottawa', 'Canada', 'Ontario', 'America/Toronto', 45.4215, -75.6972, '🏛️', []],
    ['winnipeg', 'Winnipeg', 'Canada', 'Manitoba', 'America/Winnipeg', 49.8951, -97.1384, '🏙️', []],
    ['quebec_city', 'Quebec City', 'Canada', 'Quebec', 'America/Toronto', 46.8139, -71.2080, '🏰', []],
    ['mexico_city', 'Mexico City', 'Mexico', 'Mexico City', 'America/Mexico_City', 19.4326, -99.1332, '🌆', ['cdmx']],
    ['guadalajara', 'Guadalajara', 'Mexico', 'Jalisco', 'America/Mexico_City', 20.6597, -103.3496, '🏙️', []],
    ['monterrey', 'Monterrey', 'Mexico', 'Nuevo León', 'America/Monterrey', 25.6866, -100.3161, '🏔️', []],
    ['puebla', 'Puebla', 'Mexico', 'Puebla', 'America/Mexico_City', 19.0414, -98.2063, '🏙️', []],
    ['tijuana', 'Tijuana', 'Mexico', 'Baja California', 'America/Tijuana', 32.5149, -117.0382, '🌊', []],
    ['havana', 'Havana', 'Cuba', 'La Habana', 'America/Havana', 23.1136, -82.3666, '🌴', []],
    ['santo_domingo', 'Santo Domingo', 'Dominican Republic', 'Distrito Nacional', 'America/Santo_Domingo', 18.4861, -69.9312, '🌴', []],
    ['guatemala_city', 'Guatemala City', 'Guatemala', 'Guatemala', 'America/Guatemala', 14.6349, -90.5069, '🏙️', []],
    ['panama_city', 'Panama City', 'Panama', 'Panama', 'America/Panama', 8.9824, -79.5199, '🌆', []],

    ['sao_paulo', 'São Paulo', 'Brazil', 'São Paulo', 'America/Sao_Paulo', -23.5505, -46.6333, '🌆', ['sao paulo']],
    ['rio_de_janeiro', 'Rio de Janeiro', 'Brazil', 'Rio de Janeiro', 'America/Sao_Paulo', -22.9068, -43.1729, '🌊', ['rio']],
    ['brasilia', 'Brasília', 'Brazil', 'Federal District', 'America/Sao_Paulo', -15.7939, -47.8828, '🏛️', ['brasilia']],
    ['salvador', 'Salvador', 'Brazil', 'Bahia', 'America/Bahia', -12.9777, -38.5016, '🌊', []],
    ['fortaleza', 'Fortaleza', 'Brazil', 'Ceará', 'America/Fortaleza', -3.7319, -38.5267, '🌊', []],
    ['belo_horizonte', 'Belo Horizonte', 'Brazil', 'Minas Gerais', 'America/Sao_Paulo', -19.9167, -43.9345, '🏙️', []],
    ['manaus', 'Manaus', 'Brazil', 'Amazonas', 'America/Manaus', -3.1190, -60.0217, '🌴', []],
    ['curitiba', 'Curitiba', 'Brazil', 'Paraná', 'America/Sao_Paulo', -25.4284, -49.2733, '🏙️', []],
    ['recife', 'Recife', 'Brazil', 'Pernambuco', 'America/Recife', -8.0476, -34.8770, '🌊', []],
    ['porto_alegre', 'Porto Alegre', 'Brazil', 'Rio Grande do Sul', 'America/Sao_Paulo', -30.0346, -51.2177, '🏙️', []],
    ['buenos_aires', 'Buenos Aires', 'Argentina', 'Buenos Aires', 'America/Argentina/Buenos_Aires', -34.6037, -58.3816, '🌆', []],
    ['cordoba', 'Córdoba', 'Argentina', 'Córdoba', 'America/Argentina/Cordoba', -31.4201, -64.1888, '🏙️', ['cordoba']],
    ['rosario', 'Rosario', 'Argentina', 'Santa Fe', 'America/Argentina/Cordoba', -32.9442, -60.6505, '🏙️', []],
    ['lima', 'Lima', 'Peru', 'Lima', 'America/Lima', -12.0464, -77.0428, '🌊', []],
    ['bogota', 'Bogotá', 'Colombia', 'Bogotá', 'America/Bogota', 4.7110, -74.0721, '🏙️', ['bogota']],
    ['medellin', 'Medellín', 'Colombia', 'Antioquia', 'America/Bogota', 6.2476, -75.5658, '🏔️', ['medellin']],
    ['cali', 'Cali', 'Colombia', 'Valle del Cauca', 'America/Bogota', 3.4516, -76.5320, '🏙️', []],
    ['santiago', 'Santiago', 'Chile', 'Santiago Metropolitan', 'America/Santiago', -33.4489, -70.6693, '🏔️', []],
    ['valparaiso', 'Valparaíso', 'Chile', 'Valparaíso', 'America/Santiago', -33.0472, -71.6127, '🌊', ['valparaiso']],
    ['caracas', 'Caracas', 'Venezuela', 'Capital District', 'America/Caracas', 10.4806, -66.9036, '🏙️', []],
    ['maracaibo', 'Maracaibo', 'Venezuela', 'Zulia', 'America/Caracas', 10.6545, -71.6530, '🌊', []],
    ['quito', 'Quito', 'Ecuador', 'Pichincha', 'America/Guayaquil', -0.1807, -78.4678, '🏔️', []],
    ['guayaquil', 'Guayaquil', 'Ecuador', 'Guayas', 'America/Guayaquil', -2.1700, -79.9224, '🌊', []],
    ['la_paz', 'La Paz', 'Bolivia', 'La Paz', 'America/La_Paz', -16.4897, -68.1193, '🏔️', []],
    ['santa_cruz', 'Santa Cruz', 'Bolivia', 'Santa Cruz', 'America/La_Paz', -17.7833, -63.1821, '🏙️', []],
    ['montevideo', 'Montevideo', 'Uruguay', 'Montevideo', 'America/Montevideo', -34.9011, -56.1645, '🌊', []],
    ['asuncion', 'Asunción', 'Paraguay', 'Asunción', 'America/Asuncion', -25.2637, -57.5759, '🏙️', ['asuncion']],

    ['cairo', 'Cairo', 'Egypt', 'Cairo', 'Africa/Cairo', 30.0444, 31.2357, '🏜️', []],
    ['alexandria', 'Alexandria', 'Egypt', 'Alexandria', 'Africa/Cairo', 31.2001, 29.9187, '🌊', []],
    ['giza', 'Giza', 'Egypt', 'Giza', 'Africa/Cairo', 30.0131, 31.2089, '🔺', []],
    ['lagos', 'Lagos', 'Nigeria', 'Lagos', 'Africa/Lagos', 6.5244, 3.3792, '🌆', []],
    ['abuja', 'Abuja', 'Nigeria', 'FCT', 'Africa/Lagos', 9.0765, 7.3986, '🏛️', []],
    ['kano', 'Kano', 'Nigeria', 'Kano', 'Africa/Lagos', 12.0022, 8.5920, '🏙️', []],
    ['ibadan', 'Ibadan', 'Nigeria', 'Oyo', 'Africa/Lagos', 7.3775, 3.9470, '🏙️', []],
    ['kinshasa', 'Kinshasa', 'DR Congo', 'Kinshasa', 'Africa/Kinshasa', -4.4419, 15.2663, '🌆', []],
    ['luanda', 'Luanda', 'Angola', 'Luanda', 'Africa/Luanda', -8.8390, 13.2894, '🌊', []],
    ['johannesburg', 'Johannesburg', 'South Africa', 'Gauteng', 'Africa/Johannesburg', -26.2041, 28.0473, '🌆', ['joburg']],
    ['cape_town', 'Cape Town', 'South Africa', 'Western Cape', 'Africa/Johannesburg', -33.9249, 18.4241, '🌊', []],
    ['durban', 'Durban', 'South Africa', 'KwaZulu-Natal', 'Africa/Johannesburg', -29.8587, 31.0218, '🌊', []],
];

function toLocation(row) {
    const [
        key,
        display,
        country,
        region,
        timezone,
        lat,
        lon,
        icon,
        aliases = [],
    ] = row;

    return [
        key,
        {
            key,
            lat,
            lon,
            display,
            country,
            region,
            timezone,
            icon: icon || '📍',
            aliases,
            enabled: true,
        },
    ];
}

export const WEATHER_LOCATION_REGISTRY = Object.freeze(
    Object.fromEntries(LOCATION_ROWS.map(toLocation))
);

export function normalizeWeatherCity(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');
}

function normalizeRegistryKey(value) {
    return normalizeWeatherCity(value).replace(/\s+/g, '_');
}

export function resolveRegistryKey(cityName) {
    const normalized = normalizeWeatherCity(cityName);
    const keyLike = normalizeRegistryKey(cityName);

    if (WEATHER_LOCATION_REGISTRY[keyLike]) return keyLike;

    for (const [canonical, entry] of Object.entries(WEATHER_LOCATION_REGISTRY)) {
        const candidates = [
            canonical,
            entry.key,
            entry.display,
            ...(entry.aliases || []),
        ].map(normalizeWeatherCity);

        if (candidates.includes(normalized)) return canonical;
    }

    return null;
}

export function getCityWeatherKey(cityName) {
    return resolveRegistryKey(cityName) || normalizeRegistryKey(cityName);
}

export function getWeatherLocation(cityName) {
    const key = resolveRegistryKey(cityName);
    return key ? WEATHER_LOCATION_REGISTRY[key] : null;
}

export function getWeatherLocationLabel(cityName) {
    const location = getWeatherLocation(cityName);
    if (location) return location.display;

    const raw = String(cityName || '').trim();
    if (!raw) return 'Unknown';

    return raw
        .replace(/[_-]+/g, ' ')
        .split(/\s+/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

export function getWeatherLocationOptions() {
    return Object.values(WEATHER_LOCATION_REGISTRY)
        .filter(location => location.enabled !== false)
        .map(location => ({
            key: location.key,
            label: location.display,
            country: location.country,
            region: location.region || '',
            timezone: location.timezone || '',
            icon: location.icon || '📍',
            lat: location.lat,
            lon: location.lon,
            searchText: [
                location.display,
                location.country,
                location.region,
                location.key,
                ...(location.aliases || []),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase(),
        }))
        .sort((a, b) => {
            const countryCompare = String(a.country || '').localeCompare(String(b.country || ''));
            if (countryCompare !== 0) return countryCompare;
            return String(a.label || '').localeCompare(String(b.label || ''));
        });
}

export function uniqueWeatherCities(cities) {
    const result = [];

    for (const city of Array.isArray(cities) ? cities : []) {
        const key = resolveRegistryKey(city);
        if (!key || result.includes(key)) continue;
        if (!WEATHER_LOCATION_REGISTRY[key]) continue;
        result.push(key);
    }

    return result;
}

export function getConfiguredWeatherCities(settings) {
    const raw = settings?.weather?.cities;
    const normalized = uniqueWeatherCities(raw);

    if (normalized.length === 0) return [...DEFAULT_WEATHER_CITIES];

    const configVersion = settings?.weather?.locationConfigVersion;
    const alreadyMigrated = configVersion === WEATHER_LOCATION_CONFIG_VERSION;

    if (!alreadyMigrated) {
        // Colombo-removal migration: only configs coming from the prior
        // force-restore version (v7) get the auto-injected cities stripped.
        // This reverses the 59A auto-add without touching lists a user built
        // on any other version.
        if (configVersion === COLOMBO_RESTORE_VERSION) {
            const pruned = normalized.filter((city) => !AUTO_RESTORE_LEGACY_CITIES.includes(city));
            return pruned.length ? pruned : [...DEFAULT_WEATHER_CITIES];
        }
        return normalized;
    }

    return normalized;
}

export function buildWeatherSettingsWithCities(baseSettings, cities) {
    const nextCities = uniqueWeatherCities(cities);

    return {
        ...baseSettings,
        weather: {
            ...(baseSettings?.weather || {}),
            cities: nextCities.length ? nextCities : [...DEFAULT_WEATHER_CITIES],
            locationConfigVersion: WEATHER_LOCATION_CONFIG_VERSION,
        },
    };
}

export const __weatherLocationsInternalsForTest = {
    LOCATION_ROWS,
    normalizeRegistryKey,
};

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    concurrent_submit: {
      executor: 'constant-vus',
      vus: 300,
      duration: '60s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  const form = new FormData();
  form.append('first_name', 'Test');
  form.append('middle_name', 'Volunteer');
  form.append('last_name', `User${__VU}${__ITER}`);
  form.append('full_name_amharic', 'አስመራ');
  form.append('sex', 'Male');
  form.append('age', '28');
  form.append('nationality', 'Ethiopia');
  form.append('fan_number', `FAN${__VU}${__ITER}`.slice(0, 20));
  form.append('phone', '+251900000000');
  form.append('phone_is_whatsapp', 'true');
  form.append('email', `volunteer${__VU}${__ITER}@example.com`);
  form.append('confirmEmail', `volunteer${__VU}${__ITER}@example.com`);
  form.append('residence_region', 'Addis Ababa');
  form.append('residence_detail', 'Bole');
  form.append('profession', 'Nurse');
  form.append('education_level', "Bachelor's");
  form.append('emergency_name', 'Emergency Contact');
  form.append('emergency_phone', '+251911111111');
  form.append('emergency_relationship', 'Sibling');
  form.append('sector', 'Health');
  form.append('healthSubsectors', JSON.stringify(['Public Health']));
  form.append('languages', JSON.stringify([
    { group: 'ethiopian', language: 'Amharic', proficiency: 'Native' },
    { group: 'un', language: 'English', proficiency: 'Fluent' },
  ]));
  form.append('uiLanguage', 'en');
  form.append('hasConsent', 'true');
  form.append('deviceTokenHash', 'token');
  form.append('idempotencyKey', '00000000-0000-0000-0000-000000000000');

  const res = http.post('http://localhost:3000/api/register', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  check(res, {
    'status is 201 or 400': (r) => r.status === 201 || r.status === 400,
  });

  sleep(1);
}
